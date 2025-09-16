import nodemailer, { Transporter, SendMailOptions } from "nodemailer";
import handlebars from "handlebars";
import { readFile } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { AppError } from "../../core/errors/app-error.js";

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: {
    name: string;
    email: string;
  };
  templatesPath: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailData {
  [key: string]: any;
}

const emailConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().min(1).max(65535),
  secure: z.boolean(),
  auth: z.object({
    user: z.string().email(),
    pass: z.string().min(1),
  }),
  from: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
  templatesPath: z.string().min(1),
});

export class EmailService {
  private transporter: Transporter;
  private templates: Map<string, handlebars.TemplateDelegate> = new Map();
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.validateConfig(config);
    this.config = config;
    this.setupTransporter();
    this.registerHelpers();
  }

  private validateConfig(config: EmailConfig): void {
    emailConfigSchema.parse(config);
  }

  private setupTransporter(): void {
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.auth,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }

  private registerHelpers(): void {
    // Register common Handlebars helpers
    handlebars.registerHelper("formatDate", (date: Date, format: string) => {
      if (!date) return "";

      const options: Intl.DateTimeFormatOptions = {};
      switch (format) {
        case "short":
          options.dateStyle = "short";
          break;
        case "medium":
          options.dateStyle = "medium";
          break;
        case "long":
          options.dateStyle = "long";
          break;
        case "full":
          options.dateStyle = "full";
          break;
        default:
          options.dateStyle = "medium";
      }

      return new Intl.DateTimeFormat("en-US", options).format(new Date(date));
    });

    handlebars.registerHelper(
      "formatCurrency",
      (amount: number, currency = "USD") => {
        if (typeof amount !== "number") return "";

        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
        }).format(amount);
      }
    );

    handlebars.registerHelper("eq", (a: any, b: any) => a === b);
    handlebars.registerHelper("ne", (a: any, b: any) => a !== b);
    handlebars.registerHelper("gt", (a: number, b: number) => a > b);
    handlebars.registerHelper("lt", (a: number, b: number) => a < b);
    handlebars.registerHelper("and", (a: any, b: any) => a && b);
    handlebars.registerHelper("or", (a: any, b: any) => a || b);

    handlebars.registerHelper("capitalize", (str: string) => {
      if (!str) return "";
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    handlebars.registerHelper("truncate", (str: string, length: number) => {
      if (!str) return "";
      return str.length > length ? str.substring(0, length) + "..." : str;
    });
  }

  async loadTemplate(
    templateName: string
  ): Promise<handlebars.TemplateDelegate> {
    if (this.templates.has(templateName)) {
      return this.templates.get(templateName)!;
    }

    try {
      const templatePath = join(
        this.config.templatesPath,
        `${templateName}.html`
      );
      const templateContent = await readFile(templatePath, "utf-8");
      const compiledTemplate = handlebars.compile(templateContent);

      this.templates.set(templateName, compiledTemplate);
      return compiledTemplate;
    } catch (error) {
      throw new AppError(
        `Failed to load email template: ${templateName}`,
        500,
        "TEMPLATE_LOAD_FAILED",
        {
          templateName,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      );
    }
  }

  async sendEmail(
    templateName: string,
    data: EmailData,
    options: SendEmailOptions
  ): Promise<void> {
    try {
      const template = await this.loadTemplate(templateName);

      // Add common data
      const templateData = {
        ...data,
        year: new Date().getFullYear(),
        storeName: this.config.from.name,
        supportEmail: this.config.from.email,
      };

      const html = template(templateData);

      // Generate plain text version from HTML (basic implementation)
      const text = this.htmlToText(html);

      const mailOptions: SendMailOptions = {
        from: `${this.config.from.name} <${this.config.from.email}>`,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        replyTo: options.replyTo,
        subject: this.extractSubject(html, templateData),
        html,
        text,
        attachments: options.attachments,
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      throw new AppError(
        `Failed to send email: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500,
        "EMAIL_SEND_FAILED",
        { templateName, to: options.to }
      );
    }
  }

  async sendWelcomeEmail(
    userEmail: string,
    userData: {
      firstName: string;
      lastName: string;
      activationUrl?: string;
    }
  ): Promise<void> {
    await this.sendEmail("welcome", userData, {
      to: userEmail,
    });
  }

  async sendPasswordResetEmail(
    userEmail: string,
    resetData: {
      firstName: string;
      resetUrl: string;
      expiryTime: string;
    }
  ): Promise<void> {
    await this.sendEmail("password-reset", resetData, {
      to: userEmail,
    });
  }

  async sendOrderConfirmationEmail(
    userEmail: string,
    orderData: {
      firstName: string;
      orderId: string;
      orderTotal: number;
      currency: string;
      items: Array<{
        name: string;
        quantity: number;
        price: number;
      }>;
      orderUrl: string;
    }
  ): Promise<void> {
    await this.sendEmail("order-confirmation", orderData, {
      to: userEmail,
    });
  }

  async sendOrderShippedEmail(
    userEmail: string,
    shippingData: {
      firstName: string;
      orderId: string;
      trackingNumber: string;
      trackingUrl: string;
      estimatedDelivery: string;
      orderUrl: string;
    }
  ): Promise<void> {
    await this.sendEmail("order-shipped", shippingData, {
      to: userEmail,
    });
  }

  async sendOrderDeliveredEmail(
    userEmail: string,
    deliveryData: {
      firstName: string;
      orderId: string;
      deliveredAt: Date;
      orderUrl: string;
      reviewUrl?: string;
    }
  ): Promise<void> {
    await this.sendEmail("order-delivered", deliveryData, {
      to: userEmail,
    });
  }

  async sendReviewRequestEmail(
    userEmail: string,
    reviewData: {
      firstName: string;
      productName: string;
      productImage?: string;
      reviewUrl: string;
      orderId: string;
    }
  ): Promise<void> {
    await this.sendEmail("review-request", reviewData, {
      to: userEmail,
    });
  }

  async sendVendorApplicationEmail(
    vendorEmail: string,
    applicationData: {
      businessName: string;
      contactPerson: string;
      applicationId: string;
      dashboardUrl: string;
    }
  ): Promise<void> {
    await this.sendEmail("vendor-application", applicationData, {
      to: vendorEmail,
    });
  }

  async sendVendorApprovalEmail(
    vendorEmail: string,
    approvalData: {
      businessName: string;
      contactPerson: string;
      dashboardUrl: string;
      onboardingUrl: string;
    }
  ): Promise<void> {
    await this.sendEmail("vendor-approval", approvalData, {
      to: vendorEmail,
    });
  }

  async sendPayoutNotificationEmail(
    vendorEmail: string,
    payoutData: {
      businessName: string;
      contactPerson: string;
      amount: number;
      currency: string;
      payoutId: string;
      period: string;
      dashboardUrl: string;
    }
  ): Promise<void> {
    await this.sendEmail("payout-notification", payoutData, {
      to: vendorEmail,
    });
  }

  private extractSubject(html: string, data: EmailData): string {
    // Try to extract subject from HTML title tag
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (titleMatch) {
      const template = handlebars.compile(titleMatch[1]);
      return template(data);
    }

    // Fallback to a generic subject
    return "Notification from " + this.config.from.name;
  }

  private htmlToText(html: string): string {
    // Basic HTML to text conversion
    return html
      .replace(/<style[^>]*>.*?<\/style>/gis, "")
      .replace(/<script[^>]*>.*?<\/script>/gis, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      throw new AppError(
        `Email service connection failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500,
        "EMAIL_CONNECTION_FAILED"
      );
    }
  }

  async sendBulkEmails(
    templateName: string,
    recipients: Array<{
      email: string;
      data: EmailData;
    }>,
    commonOptions?: Partial<SendEmailOptions>
  ): Promise<void> {
    const promises = recipients.map((recipient) =>
      this.sendEmail(templateName, recipient.data, {
        to: recipient.email,
        ...commonOptions,
      })
    );

    await Promise.all(promises);
  }

  // Template management
  clearTemplateCache(): void {
    this.templates.clear();
  }

  async preloadTemplates(templateNames: string[]): Promise<void> {
    const promises = templateNames.map((name) => this.loadTemplate(name));
    await Promise.all(promises);
  }

  static createFromEnv(): EmailService {
    const config: EmailConfig = {
      host: process.env.EMAIL_HOST || "localhost",
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER || "",
        pass: process.env.EMAIL_PASS || "",
      },
      from: {
        name: process.env.EMAIL_FROM_NAME || "E-commerce Store",
        email: process.env.EMAIL_FROM_EMAIL || "noreply@example.com",
      },
      templatesPath: process.env.EMAIL_TEMPLATES_PATH || "./templates",
    };

    return new EmailService(config);
  }
}

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EmailService } from "../email.service.js";
import { AppError } from "../../../core/errors/app-error.js";

// Mock nodemailer
const mockSendMail = vi.fn();
const mockVerify = vi.fn();

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
      verify: mockVerify,
    })),
  },
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
}));

// Mock handlebars
const mockCompile = vi.fn();
const mockRegisterHelper = vi.fn();

vi.mock("handlebars", () => ({
  default: {
    compile: mockCompile,
    registerHelper: mockRegisterHelper,
  },
}));

describe("EmailService", () => {
  let emailService: EmailService;
  const mockConfig = {
    host: "smtp.test.com",
    port: 587,
    secure: false,
    auth: {
      user: "test@example.com",
      pass: "password",
    },
    from: {
      name: "Test Store",
      email: "noreply@test.com",
    },
    templatesPath: "./templates",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    emailService = new EmailService(mockConfig);
  });

  describe("constructor", () => {
    it("should create email service with valid config", () => {
      expect(emailService).toBeInstanceOf(EmailService);
      expect(mockRegisterHelper).toHaveBeenCalled();
    });

    it("should throw error with invalid config", () => {
      const invalidConfig = {
        ...mockConfig,
        port: -1, // Invalid port
      };

      expect(() => new EmailService(invalidConfig)).toThrow();
    });
  });

  describe("loadTemplate", () => {
    it("should load and compile template", async () => {
      const mockTemplate = "<h1>Hello {{name}}</h1>";
      const mockCompiledTemplate = vi.fn().mockReturnValue("Hello John");

      const { readFile } = await import("fs/promises");
      vi.mocked(readFile).mockResolvedValue(mockTemplate);
      mockCompile.mockReturnValue(mockCompiledTemplate);

      const template = await emailService.loadTemplate("welcome");

      expect(readFile).toHaveBeenCalledWith(
        "./templates/welcome.html",
        "utf-8"
      );
      expect(mockCompile).toHaveBeenCalledWith(mockTemplate);
      expect(template).toBe(mockCompiledTemplate);
    });

    it("should cache loaded templates", async () => {
      const mockTemplate = "<h1>Hello {{name}}</h1>";
      const mockCompiledTemplate = vi.fn();

      const { readFile } = await import("fs/promises");
      vi.mocked(readFile).mockResolvedValue(mockTemplate);
      mockCompile.mockReturnValue(mockCompiledTemplate);

      // Load template twice
      await emailService.loadTemplate("welcome");
      await emailService.loadTemplate("welcome");

      // Should only read file once due to caching
      expect(readFile).toHaveBeenCalledTimes(1);
    });

    it("should throw error if template not found", async () => {
      const { readFile } = await import("fs/promises");
      vi.mocked(readFile).mockRejectedValue(new Error("File not found"));

      await expect(emailService.loadTemplate("nonexistent")).rejects.toThrow(
        AppError
      );
    });
  });

  describe("sendEmail", () => {
    it("should send email successfully", async () => {
      const mockTemplate = vi.fn().mockReturnValue("<h1>Hello John</h1>");
      mockCompile.mockReturnValue(mockTemplate);

      const { readFile } = await import("fs/promises");
      vi.mocked(readFile).mockResolvedValue("<h1>Hello {{name}}</h1>");

      mockSendMail.mockResolvedValue({ messageId: "test-id" });

      await emailService.sendEmail(
        "welcome",
        { name: "John" },
        { to: "john@example.com" }
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "Test Store <noreply@test.com>",
          to: "john@example.com",
          html: "<h1>Hello John</h1>",
          text: expect.any(String),
        })
      );
    });

    it("should handle email sending errors", async () => {
      const mockTemplate = vi.fn().mockReturnValue("<h1>Hello John</h1>");
      mockCompile.mockReturnValue(mockTemplate);

      const { readFile } = await import("fs/promises");
      vi.mocked(readFile).mockResolvedValue("<h1>Hello {{name}}</h1>");

      mockSendMail.mockRejectedValue(new Error("SMTP Error"));

      await expect(
        emailService.sendEmail(
          "welcome",
          { name: "John" },
          { to: "john@example.com" }
        )
      ).rejects.toThrow(AppError);
    });
  });

  describe("convenience methods", () => {
    beforeEach(async () => {
      const mockTemplate = vi.fn().mockReturnValue("<h1>Test Email</h1>");
      mockCompile.mockReturnValue(mockTemplate);

      const { readFile } = await import("fs/promises");
      vi.mocked(readFile).mockResolvedValue("<h1>{{firstName}}</h1>");

      mockSendMail.mockResolvedValue({ messageId: "test-id" });
    });

    it("should send welcome email", async () => {
      await emailService.sendWelcomeEmail("john@example.com", {
        firstName: "John",
        lastName: "Doe",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "john@example.com",
        })
      );
    });

    it("should send password reset email", async () => {
      await emailService.sendPasswordResetEmail("john@example.com", {
        firstName: "John",
        resetUrl: "https://example.com/reset",
        expiryTime: "1 hour",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "john@example.com",
        })
      );
    });

    it("should send order confirmation email", async () => {
      await emailService.sendOrderConfirmationEmail("john@example.com", {
        firstName: "John",
        orderId: "ORDER-123",
        orderTotal: 99.99,
        currency: "USD",
        items: [{ name: "Product 1", quantity: 2, price: 49.99 }],
        orderUrl: "https://example.com/orders/123",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "john@example.com",
        })
      );
    });
  });

  describe("verifyConnection", () => {
    it("should verify connection successfully", async () => {
      mockVerify.mockResolvedValue(true);

      const result = await emailService.verifyConnection();

      expect(result).toBe(true);
      expect(mockVerify).toHaveBeenCalled();
    });

    it("should handle connection errors", async () => {
      mockVerify.mockRejectedValue(new Error("Connection failed"));

      await expect(emailService.verifyConnection()).rejects.toThrow(AppError);
    });
  });

  describe("factory method", () => {
    it("should create email service from environment", () => {
      // Mock environment variables
      process.env.EMAIL_HOST = "smtp.example.com";
      process.env.EMAIL_PORT = "587";
      process.env.EMAIL_USER = "user@example.com";
      process.env.EMAIL_PASS = "password";
      process.env.EMAIL_FROM_NAME = "Example Store";
      process.env.EMAIL_FROM_EMAIL = "noreply@example.com";

      const service = EmailService.createFromEnv();

      expect(service).toBeInstanceOf(EmailService);

      // Clean up
      delete process.env.EMAIL_HOST;
      delete process.env.EMAIL_PORT;
      delete process.env.EMAIL_USER;
      delete process.env.EMAIL_PASS;
      delete process.env.EMAIL_FROM_NAME;
      delete process.env.EMAIL_FROM_EMAIL;
    });
  });
});

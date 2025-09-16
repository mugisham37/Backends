import { render, screen, fireEvent, waitFor } from "@/lib/testing/test-utils"
import { LoginForm } from "./login-form"
import { login } from "@/lib/auth"

// Mock the auth module
jest.mock("@/lib/auth", () => ({
  login: jest.fn(),
}))

describe("LoginForm", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the login form", () => {
    render(<LoginForm />)

    // Check if form elements are rendered
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument()
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument()
  })

  it("validates required fields", async () => {
    render(<LoginForm />)

    // Submit form without filling fields
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }))

    // Check for validation messages
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    })
  })

  it("validates email format", async () => {
    render(<LoginForm />)

    // Fill invalid email
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "invalid-email" },
    })

    // Fill password
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    })

    // Submit form
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }))

    // Check for validation message
    await waitFor(() => {
      expect(screen.getByText(/invalid email address/i)).toBeInTheDocument()
    })
  })

  it("submits the form with valid data", async () => {
    // Mock successful login
    ;(login as jest.Mock).mockResolvedValue({ success: true })

    render(<LoginForm />)

    // Fill form with valid data
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    })

    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    })

    // Submit form
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }))

    // Check if login was called with correct data
    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      })
    })
  })

  it("handles login error", async () => {
    // Mock login error
    ;(login as jest.Mock).mockRejectedValue(new Error("Invalid credentials"))

    render(<LoginForm />)

    // Fill form with valid data
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    })

    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    })

    // Submit form
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }))

    // Check if error message is displayed
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
  })
})

import { z } from "zod";

// Auth validation schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email address").max(255, "Email too long"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username too long")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, _ and -"),
  email: z.string().email("Invalid email address").max(255, "Email too long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

// Customer validation schema
export const customerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().email("Invalid email address").max(255, "Email too long"),
  phone: z
    .string()
    .regex(/^\+?[0-9\s\-()]+$/, "Invalid phone number format")
    .max(20, "Phone number too long")
    .optional()
    .or(z.literal("")),
  company: z.string().max(200, "Company name too long").optional().or(z.literal("")),
  notes: z.string().max(1000, "Notes too long").optional().or(z.literal("")),
});

// Product validation schema
export const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional().or(z.literal("")),
  version: z.string().max(20, "Version too long").optional().or(z.literal("")),
  price: z
    .string()
    .refine((val) => !val || !isNaN(Number(val)), "Price must be a valid number")
    .refine((val) => !val || Number(val) >= 0, "Price must be non-negative")
    .optional()
    .or(z.literal("")),
  is_active: z.boolean(),
});

// License validation schema
export const licenseSchema = z.object({
  customer_id: z.string().uuid("Invalid customer selection"),
  product_id: z.string().uuid("Invalid product selection"),
  max_devices: z
    .number()
    .int("Must be a whole number")
    .min(1, "At least 1 device required")
    .max(1000, "Maximum 1000 devices allowed"),
  expire_at: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "pending", "suspended", "expired"]),
  notes: z.string().max(1000, "Notes too long").optional().or(z.literal("")),
});

// License key validation for API
export const licenseKeySchema = z.object({
  license_key: z
    .string()
    .regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/, "Invalid license key format"),
  hwid: z.string().max(255, "Hardware ID too long").optional(),
  device_name: z.string().max(200, "Device name too long").optional(),
  os_info: z.string().max(200, "OS info too long").optional(),
});

// API key validation
export const apiKeySchema = z.object({
  name: z.string().trim().min(1, "API key name is required").max(100, "Name too long"),
  expires_at: z.string().optional().or(z.literal("")),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type LicenseInput = z.infer<typeof licenseSchema>;
export type LicenseKeyInput = z.infer<typeof licenseKeySchema>;
export type ApiKeyInput = z.infer<typeof apiKeySchema>;

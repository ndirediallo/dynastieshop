"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import { customerSchema, type CustomerInput } from "@/lib/schemas";

export async function createCustomer(input: CustomerInput) {
  const user = await requireModuleAccess("clients");
  const data = customerSchema.parse(input);

  const customer = await prisma.customer.create({
    data: {
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
    },
  });

  await logActivity({
    userId: user.id,
    action: "CUSTOMER_CREATED",
    entityType: "Customer",
    entityId: customer.id,
    details: `Client "${customer.name}" créé`,
  });

  revalidatePath("/clients");
  revalidatePath("/ventes");
  return customer;
}

export async function updateCustomer(id: string, input: CustomerInput) {
  const user = await requireModuleAccess("clients");
  const data = customerSchema.parse(input);

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
    },
  });

  await logActivity({
    userId: user.id,
    action: "CUSTOMER_UPDATED",
    entityType: "Customer",
    entityId: customer.id,
    details: `Client "${customer.name}" modifié`,
  });

  revalidatePath("/clients");
  return customer;
}

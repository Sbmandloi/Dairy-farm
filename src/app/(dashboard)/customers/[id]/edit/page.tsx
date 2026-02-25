import { notFound } from "next/navigation";
import { getCustomerById } from "@/lib/services/customer.service";
import { Header } from "@/components/layout/header";
import { CustomerForm } from "@/components/customers/customer-form";
import { decimalToNumber } from "@/lib/utils/format";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerPage({ params }: Props) {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  // Serialize Prisma Decimal and Date → plain JS types before passing to Client Component
  const serialized = {
    id: customer.id,
    name: customer.name,
    phoneNumber: customer.phoneNumber,
    address: customer.address,
    pricePerLiter: customer.pricePerLiter != null ? decimalToNumber(customer.pricePerLiter) : null,
    startDate: new Date(customer.startDate).toISOString().split("T")[0],
  };

  return (
    <div>
      <Header title="Edit Customer" />
      <div className="p-4 md:p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Edit {customer.name}</h2>
          <p className="text-sm text-gray-500 mt-1">Update customer information</p>
        </div>
        <CustomerForm customer={serialized} />
      </div>
    </div>
  );
}

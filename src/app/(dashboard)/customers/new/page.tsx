import { Header } from "@/components/layout/header";
import { CustomerForm } from "@/components/customers/customer-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewCustomerPage() {
  return (
    <div>
      <Header title="Add Customer" />
      <div className="p-4 md:p-6">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to customers
        </Link>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">New Customer</h2>
          <p className="text-sm text-gray-500 mt-1">Add a new milk delivery customer</p>
        </div>
        <CustomerForm />
      </div>
    </div>
  );
}

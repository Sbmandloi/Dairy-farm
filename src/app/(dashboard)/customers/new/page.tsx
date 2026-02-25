import { Header } from "@/components/layout/header";
import { CustomerForm } from "@/components/customers/customer-form";

export default function NewCustomerPage() {
  return (
    <div>
      <Header title="Add Customer" />
      <div className="p-4 md:p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">New Customer</h2>
          <p className="text-sm text-gray-500 mt-1">Add a new milk delivery customer</p>
        </div>
        <CustomerForm />
      </div>
    </div>
  );
}

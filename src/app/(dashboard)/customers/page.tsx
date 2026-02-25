import { getCustomersWithStats } from "@/lib/services/customer.service";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, Phone, MapPin, IndianRupee, Droplets, TrendingUp, Users, AlertCircle } from "lucide-react";
import { formatCurrency, formatDate, decimalToNumber } from "@/lib/utils/format";
import { CustomerToggleButton } from "@/components/customers/customer-status-badge";
import { ExportButton } from "@/components/customers/export-button";

interface PageProps {
  searchParams: Promise<{ search?: string; status?: string }>;
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search || "";
  const status = params.status;

  const customers = await getCustomersWithStats({
    active: status === "inactive" ? false : status === "active" ? true : undefined,
    search,
  });

  const totalLiters = customers.reduce((s, c) => s + c.stats.totalLiters, 0);
  const totalBilled = customers.reduce((s, c) => s + c.stats.totalBilled, 0);
  const totalBalance = customers.reduce((s, c) => s + c.stats.balance, 0);
  const activeCount = customers.filter((c) => c.isActive).length;

  return (
    <div>
      <Header title="Customers" />
      <div className="p-4 md:p-6 space-y-5">

        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Total Customers",
              value: customers.length.toString(),
              sub: `${activeCount} active`,
              icon: <Users className="w-5 h-5 text-blue-500" />,
              color: "bg-blue-50 border-blue-100",
            },
            {
              label: "Total Liters",
              value: `${totalLiters.toFixed(1)} L`,
              sub: "all time",
              icon: <Droplets className="w-5 h-5 text-cyan-500" />,
              color: "bg-cyan-50 border-cyan-100",
            },
            {
              label: "Total Billed",
              value: formatCurrency(totalBilled),
              sub: "all time",
              icon: <TrendingUp className="w-5 h-5 text-green-500" />,
              color: "bg-green-50 border-green-100",
            },
            {
              label: "Outstanding",
              value: formatCurrency(totalBalance),
              sub: "pending collection",
              icon: <AlertCircle className="w-5 h-5 text-orange-500" />,
              color: "bg-orange-50 border-orange-100",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`border rounded-xl p-3 md:p-4 ${stat.color} transition-all hover:shadow-sm`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-gray-500">{stat.label}</p>
                {stat.icon}
              </div>
              <p className="text-lg md:text-xl font-bold text-gray-900 leading-tight">{stat.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "All", value: "" },
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ].map((f) => (
              <Link key={f.value} href={`/customers?status=${f.value}&search=${search}`}>
                <Button
                  variant={status === f.value || (!status && f.value === "") ? "default" : "outline"}
                  size="sm"
                >
                  {f.label}
                </Button>
              </Link>
            ))}
          </div>
          <div className="flex gap-2">
            <ExportButton />
            <Link href="/customers/new">
              <Button size="sm">
                <Plus className="w-4 h-4" />
                Add Customer
              </Button>
            </Link>
          </div>
        </div>

        {/* Search */}
        <form method="GET" action="/customers">
          <input type="hidden" name="status" value={status || ""} />
          <input
            name="search"
            defaultValue={search}
            placeholder="Search by name or phone..."
            className="flex h-9 w-full max-w-sm rounded-md border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 transition-shadow"
          />
        </form>

        {/* Customer grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => (
            <div
              key={c.id}
              className="group bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-blue-200 transition-all duration-200"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Link
                    href={`/customers/${c.id}`}
                    className="font-semibold text-gray-900 hover:text-blue-600 transition-colors text-base leading-tight"
                  >
                    {c.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={c.isActive ? "success" : "secondary"} className="text-[10px]">
                      {c.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <span className="text-xs text-gray-400">since {formatDate(c.startDate)}</span>
                  </div>
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-1 text-sm text-gray-500 mb-3">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{c.phoneNumber}</span>
                </div>
                {c.address && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{c.address}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    {c.pricePerLiter
                      ? `${formatCurrency(decimalToNumber(c.pricePerLiter))}/L (custom)`
                      : "Global rate"}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3 pt-3 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-xs text-gray-400 leading-tight">Liters</p>
                  <p className="text-sm font-bold text-blue-600 mt-0.5">
                    {c.stats.totalLiters.toFixed(1)}L
                  </p>
                  <p className="text-[10px] text-gray-400">{c.stats.deliveryDays} days</p>
                </div>
                <div className="text-center border-x border-gray-100">
                  <p className="text-xs text-gray-400 leading-tight">Billed</p>
                  <p className="text-sm font-bold text-gray-700 mt-0.5">
                    {formatCurrency(c.stats.totalBilled)}
                  </p>
                  <p className="text-[10px] text-gray-400">total</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 leading-tight">Balance</p>
                  <p
                    className={`text-sm font-bold mt-0.5 ${
                      c.stats.balance > 0 ? "text-orange-500" : "text-green-600"
                    }`}
                  >
                    {formatCurrency(c.stats.balance)}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {c.stats.balance > 0 ? "due" : "clear"}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Link href={`/customers/${c.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full group-hover:border-blue-300 transition-colors">
                    View
                  </Button>
                </Link>
                <Link href={`/customers/${c.id}/edit`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">Edit</Button>
                </Link>
                <CustomerToggleButton customerId={c.id} isActive={c.isActive} />
              </div>
            </div>
          ))}

          {customers.length === 0 && (
            <div className="col-span-full text-center py-16 text-gray-400">
              <UsersSvg className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No customers found</p>
              <p className="text-sm mt-1">Add your first customer to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UsersSvg({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { TransactionLedger } from "@/components/transactions/TransactionLedger";

export const Route = createFileRoute("/spending")({
  head: () => ({
    meta: [
      { title: "Spending — MoneyTree" },
      {
        name: "description",
        content:
          "Every expense in your money tree, grouped by date with category, place, payment method and time.",
      },
      { property: "og:title", content: "Spending — MoneyTree" },
      { property: "og:description", content: "Browse, edit and delete every expense you recorded." },
    ],
  }),
  component: () => (
    <TransactionLedger
      type="expense"
      title="Spending"
      subtitle="Where your money actually went, day by day."
    />
  ),
});

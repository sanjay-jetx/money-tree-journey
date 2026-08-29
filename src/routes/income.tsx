import { createFileRoute } from "@tanstack/react-router";
import { TransactionLedger } from "@/components/transactions/TransactionLedger";

export const Route = createFileRoute("/income")({
  head: () => ({
    meta: [
      { title: "Income — MoneyTree" },
      {
        name: "description",
        content:
          "Every rupee that joined your tree: salary, scholarship, freelance, allowance, refunds and gifts.",
      },
      { property: "og:title", content: "Income — MoneyTree" },
      { property: "og:description", content: "Track all the money coming in, by date and source." },
    ],
  }),
  component: () => (
    <TransactionLedger
      type="income"
      title="Income"
      subtitle="Every time money joined your tree, and where it came from."
    />
  ),
});

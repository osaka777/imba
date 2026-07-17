import type { Metadata } from "next";

import { SnakeGame } from "~/entities/snake/ui/SnakeGame";

export const metadata: Metadata = {
  title: "Snake Casino | IMB BET",
  description: "Казино-змейка: ставка, рост множителя и cash out",
};

export default function SnakeCasinoPage() {
  return <SnakeGame />;
}

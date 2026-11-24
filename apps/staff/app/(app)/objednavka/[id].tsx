import { useLocalSearchParams } from "expo-router";
import { OrderDetailScreen } from "@/features/orders/OrderDetailScreen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OrderDetailScreen id={id} />;
}

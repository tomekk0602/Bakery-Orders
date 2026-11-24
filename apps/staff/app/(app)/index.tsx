import { Redirect } from "expo-router";

// The first tab every role has.
export default function Index() {
  return <Redirect href="/dnes" />;
}

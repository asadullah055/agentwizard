import { ProviderName, TelephonyProvider } from "./TelephonyProvider";
import { retellProvider } from "./providers/retell";
import { vapiProvider } from "./providers/vapi";

export function getProvider(provider: ProviderName): TelephonyProvider {
  switch (provider) {
    case "retell":
      return retellProvider;
    case "vapi":
      return vapiProvider;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

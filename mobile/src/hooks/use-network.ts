import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";

/**
 * Network monitoring.
 *
 * Two jobs: tell React Query when the device comes back so it can refetch, and
 * expose the state to the UI so a screen can say "you are offline" instead of
 * showing an unexplained error.
 *
 * `isInternetReachable` is preferred over `isConnected` because a phone on a
 * café wifi with a captive portal is "connected" and cannot reach anything —
 * treating that as online produces exactly the confusing failures this is meant
 * to explain. It is null while being determined, in which case connectivity is
 * assumed rather than blocking the user.
 */

/** Bridge NetInfo into React Query. Called once, at app start. */
export function startNetworkMonitor(): () => void {
  return NetInfo.addEventListener((state) => {
    onlineManager.setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
  });
}

export interface NetworkState {
  isOnline: boolean;
  /** e.g. "wifi", "cellular" — shown when explaining a slow or failed request. */
  type: string;
}

export function useNetwork(): NetworkState {
  const [state, setState] = useState<NetworkState>({ isOnline: true, type: "unknown" });

  useEffect(() => {
    return NetInfo.addEventListener((info) => {
      setState({
        isOnline: Boolean(info.isConnected) && info.isInternetReachable !== false,
        type: info.type,
      });
    });
  }, []);

  return state;
}

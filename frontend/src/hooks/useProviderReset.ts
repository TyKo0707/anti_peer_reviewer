import { useEffect, useRef } from "react";
import { BrowserProvider } from "ethers";

/**
 * Reloads the page if the connected chain is rewound (e.g. Hardhat node restart).
 */
export function useProviderReset(provider: BrowserProvider | null) {
  const highestSeen = useRef<number>(0);

  useEffect(() => {
    if (!provider) return;

    const listener = (bn: number) => {
      if (bn < highestSeen.current) {
        console.warn("⚠️  Local chain reset detected — refreshing UI");
        window.location.reload();
      }
      highestSeen.current = bn;
    };

    provider.on("block", listener);

    return () => {
      provider.off("block", listener);
    };
  }, [provider]);
}


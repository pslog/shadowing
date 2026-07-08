"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/lib/store/DataProvider";
import { FullScreenLoading } from "@/components/ui/loading";

export default function Home() {
  const { ready } = useData();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace("/dashboard");
  }, [ready, router]);

  return <FullScreenLoading />;
}

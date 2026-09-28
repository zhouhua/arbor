"use client";

import { useStore } from "zustand";
import { useTreeStore } from "@/store/tree-store";

export function useTemporal() {
  return useStore(useTreeStore.temporal);
}

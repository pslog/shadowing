"use client";

const VISITOR_STORAGE_KEY = "shadowing-jp-visitor-id";

export function getAnonymousSessionId(): string {
  let anonymousSessionId = window.sessionStorage.getItem(VISITOR_STORAGE_KEY);
  if (!anonymousSessionId) {
    anonymousSessionId = crypto.randomUUID();
    window.sessionStorage.setItem(VISITOR_STORAGE_KEY, anonymousSessionId);
  }
  return anonymousSessionId;
}

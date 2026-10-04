import { InMemoryGrantUsageStore } from "@aicoo/sharedos-core";

/** Isolated replay/usage/outbox fixture. Not durable; production storage is host-owned. */
export class InMemoryReplayStore extends InMemoryGrantUsageStore {}

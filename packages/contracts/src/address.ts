import { z } from "zod";

import { IdentifierSchema } from "./common.js";

export const HumanAddressSchema = z
  .object({ kind: z.literal("human"), userId: IdentifierSchema })
  .strict();
export type HumanAddress = z.infer<typeof HumanAddressSchema>;

export const AgentAddressSchema = z
  .object({ kind: z.literal("agent"), agentId: IdentifierSchema })
  .strict();
export type AgentAddress = z.infer<typeof AgentAddressSchema>;

export const GroupAddressSchema = z
  .object({ kind: z.literal("group"), conversationId: IdentifierSchema })
  .strict();
export type GroupAddress = z.infer<typeof GroupAddressSchema>;

export const ServiceAddressSchema = z
  .object({ kind: z.literal("service"), serviceId: IdentifierSchema })
  .strict();
export type ServiceAddress = z.infer<typeof ServiceAddressSchema>;

/** A structured protocol address; no string suffix or prefix parsing is needed. */
export const AddressSchema = z.discriminatedUnion("kind", [
  HumanAddressSchema,
  AgentAddressSchema,
  GroupAddressSchema,
  ServiceAddressSchema,
]);

export type Address = z.infer<typeof AddressSchema>;

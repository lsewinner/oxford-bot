import { queryOptions } from "@tanstack/react-query";
import { getSharedBot, listFeaturedBots, listSquareBots } from "./bot-shares.functions";

export const sharedBotQuery = (token: string) =>
  queryOptions({ queryKey: ["shared-bot", token], queryFn: () => getSharedBot({ data: { token } }) });

export const featuredBotsQuery = () =>
  queryOptions({ queryKey: ["featured-bots"], queryFn: () => listFeaturedBots() });

export const squareBotsQuery = () =>
  queryOptions({ queryKey: ["square-bots"], queryFn: () => listSquareBots() });

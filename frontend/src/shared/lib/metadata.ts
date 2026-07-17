import { Metadata } from "next";

const DEFAULT_HOST = "https://imba.bet";

export const SITE_DESCRIPTION =
  "Imba.bet — ставки на спорт: live и линия на футбол, теннис и киберспорт. Пополнение Kaspi и USDT.";

type MakeMetadataOptions = {
  description?: string;
  path?: string;
  noIndex?: boolean;
};

function siteHost(): string {
  return process.env.NEXT_PUBLIC_HOST || DEFAULT_HOST;
}

export const makeMetadata = (
  pageTitle?: string,
  options?: MakeMetadataOptions,
): Metadata => {
  const description = options?.description ?? SITE_DESCRIPTION;
  const canonical = options?.path ? `${siteHost()}${options.path}` : undefined;

  const title: Metadata["title"] = pageTitle
    ? pageTitle
    : { absolute: "Imba.bet — ставки на спорт онлайн" };

  const metadata: Metadata = {
    description,
    title,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      description,
      siteName: "Imba.bet",
      title: typeof title === "string" ? title : "Imba.bet — ставки на спорт онлайн",
      type: "website",
      ...(canonical ? { url: canonical } : {}),
    },
  };

  if (options?.noIndex) {
    metadata.robots = { follow: false, index: false };
  }

  return metadata;
};

export const noIndexMetadata = (): Metadata =>
  makeMetadata(undefined, { noIndex: true });

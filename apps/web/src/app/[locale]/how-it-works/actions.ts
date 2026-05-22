
import { createClient } from "@supabase/supabase-js";

const BUCKET = "travenest";
const SIGNED_URL_EXPIRY = 60 * 60; // 1 hour

// Upload images to these paths in your Supabase 'travenest' bucket:
//   how-it-works/customer/01-search.webp
//   how-it-works/customer/02-request.webp
//   how-it-works/customer/03-compare.webp
//   how-it-works/customer/04-book.webp
//   how-it-works/customer/05-pay.webp
//   how-it-works/customer/06-travel.webp
//   how-it-works/owner/01-register.webp
//   how-it-works/owner/02-verify.webp
//   how-it-works/owner/03-list.webp
//   how-it-works/owner/04-receive.webp
//   how-it-works/owner/05-quotes.webp
//   how-it-works/owner/06-manage.webp
export const HOW_IT_WORKS_PATHS = {
  customer: [
    "how-it-works/customer/01-search.webp",
    "how-it-works/customer/02-request.webp",
    "how-it-works/customer/03-compare.webp",
    "how-it-works/customer/04-book.webp",
    "how-it-works/customer/05-pay.webp",
    "how-it-works/customer/06-travel.webp",
  ],
  owner: [
    "how-it-works/owner/01-register.webp",
    "how-it-works/owner/02-verify.webp",
    "how-it-works/owner/03-list.webp",
    "how-it-works/owner/04-receive.webp",
    "how-it-works/owner/05-quotes.webp",
    "how-it-works/owner/06-manage.webp",
  ],
} as const;

export interface HowItWorksImages {
  customer: (string | null)[];
  owner: (string | null)[];
}

export async function getHowItWorksImages(): Promise<HowItWorksImages> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  const empty: HowItWorksImages = {
    customer: Array(6).fill(null),
    owner: Array(6).fill(null),
  };

  if (!supabaseUrl || !supabaseKey) return empty;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const getSignedUrls = async (paths: readonly string[]): Promise<(string | null)[]> => {
      const results = await Promise.allSettled(
        paths.map(async (path) => {
          const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(path, SIGNED_URL_EXPIRY);
          if (error || !data?.signedUrl) return null;
          return data.signedUrl;
        }),
      );
      return results.map((r) => (r.status === "fulfilled" ? r.value : null));
    };

    const [customer, owner] = await Promise.all([
      getSignedUrls(HOW_IT_WORKS_PATHS.customer),
      getSignedUrls(HOW_IT_WORKS_PATHS.owner),
    ]);

    return { customer, owner };
  } catch {
    return empty;
  }
}

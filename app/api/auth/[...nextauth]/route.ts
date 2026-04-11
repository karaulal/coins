import NextAuth, { type AuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import TwitterProvider from "next-auth/providers/twitter";

type XJWT = JWT & {
	xAccessToken?: string;
	xAccessTokenSecret?: string;
	xUserName?: string | null;
};

type XSession = {
	xUserName?: string | null;
};

export const authOptions: AuthOptions = {
	session: { strategy: "jwt" },
	providers: [
		TwitterProvider({
			clientId: String(process.env.AUTH_TWITTER_ID || ""),
			clientSecret: String(process.env.AUTH_TWITTER_SECRET || ""),
			version: "1.0A",
		}),
	],
	callbacks: {
		async jwt({ token, account, profile }) {
			const nextToken = token as XJWT;
			if (account?.provider === "twitter") {
				nextToken.xAccessToken = typeof account.oauth_token === "string" ? account.oauth_token : undefined;
				nextToken.xAccessTokenSecret = typeof account.oauth_token_secret === "string" ? account.oauth_token_secret : undefined;

				if (profile && typeof profile === "object") {
					const profileRecord = profile as Record<string, unknown>;
					if (typeof profileRecord.screen_name === "string") {
						nextToken.xUserName = profileRecord.screen_name;
					}
				}
			}

			return nextToken;
		},
		async session({ session, token }) {
			(session as XSession).xUserName = (token as XJWT).xUserName || null;
			return session;
		},
	},
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

import { redirect } from "@sveltejs/kit";

// The legacy home URL: without a server, the client redirects.
export const load = () => redirect(301, "/");

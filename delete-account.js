import { createClient } from "@supabase/supabase-js";

// This client uses the SECRET service role key — it can bypass all
// security rules, which is exactly why it only exists here on the
// server, never in any file sent to the browser.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ message: "Missing authorization token." });
  }

  // Verify the token actually belongs to a real, currently logged-in user.
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userData?.user) {
    return res.status(401).json({ message: "Invalid or expired session." });
  }

  const userId = userData.user.id;

  // Delete the auth account. Because our tables reference auth.users
  // with "on delete cascade", this automatically removes the user's
  // profile, products, conversations, and chat messages too.
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (deleteError) {
    console.error("Delete account error:", deleteError);
    return res.status(500).json({ message: "Something went wrong deleting your account." });
  }

  return res.status(200).json({ message: "Account deleted successfully." });
}
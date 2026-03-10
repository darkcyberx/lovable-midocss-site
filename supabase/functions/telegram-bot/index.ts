import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_API = "https://api.telegram.org/bot";
const PRICE_PER_DAY = 10;
const PAYMENT_NUMBER = "01009046911";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return new Response("OK", { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();

    // Handle admin action: notify customer of approval with optional license key
    if (body?.action === "notify_approval") {
      const { chat_id, name, license_key, max_devices } = body;
      let msg = "━━━━━━━━━━━━━━━━━━━━━\n✅ *تم تفعيل حسابك بنجاح!*\n━━━━━━━━━━━━━━━━━━━━━\n\n";
      msg += `👤 مرحباً *${name}*!\n\n`;
      if (license_key) {
        msg += `🔑 *مفتاح الترخيص الخاص بك:*\n\`${license_key}\`\n\n`;
        msg += `💻 عدد الأجهزة المسموح بها: *${max_devices}*\n\n`;
      }
      msg += "يمكنك الآن استخدام البوت لعرض تراخيصك والتجديد.\n\nاضغط /start للبدء 🚀";
      await fetch(`${TELEGRAM_API}${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text: msg, parse_mode: "Markdown" }),
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle admin action: notify customer of rejection
    if (body?.action === "notify_rejection") {
      const { chat_id, reason } = body;
      const reasonText = reason ? `\n📝 السبب: ${reason}` : "";
      await fetch(`${TELEGRAM_API}${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id,
          text: `❌ *تم رفض طلب التسجيل*${reasonText}\n\nيمكنك المحاولة مرة أخرى أو التواصل مع الدعم.`,
          parse_mode: "Markdown",
        }),
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle admin action: proxy file download from Telegram (never expose token URL to client)
    if (body?.action === "get_file" && body?.file_id) {
      // Require auth for this action to prevent unauthenticated access
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await adminClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const fileRes = await fetch(`${TELEGRAM_API}${TELEGRAM_BOT_TOKEN}/getFile?file_id=${body.file_id}`);
      const fileData = await fileRes.json();
      if (!fileData.ok) {
        return new Response(JSON.stringify({ error: "File not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const filePath = fileData.result.file_path;
      // Proxy the file server-side — never return the token URL to the client
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
      const downloadRes = await fetch(fileUrl);
      if (!downloadRes.ok) {
        return new Response(JSON.stringify({ error: "File download failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(downloadRes.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": downloadRes.headers.get("Content-Type") || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${filePath.split("/").pop()}"`,
        },
      });
    }

    const update = body;

    // Handle callback queries (button presses)
    if (update?.callback_query) {
      await handleCallbackQuery(supabase, update.callback_query, TELEGRAM_BOT_TOKEN);
      return new Response("OK", { status: 200 });
    }

    const message = update?.message;
    if (!message) {
      return new Response("OK", { status: 200 });
    }

    const chatId = message.chat.id;
    const text = message.text?.trim() || "";
    const photo = message.photo; // array of photo sizes or undefined
    const location = message.location; // { latitude, longitude }

    // ── Handle location message (optional) ──────────────────────────
    if (location) {
      await handleLocationReceived(supabase, chatId, location.latitude, location.longitude, TELEGRAM_BOT_TOKEN);
      return new Response("OK", { status: 200 });
    }

    // Handle message_type = new_chat_members (user just joined / opened chat)
    if (message?.new_chat_members || message?.chat?.type === "private" && !text && !photo) {
      await sendMainMenu(chatId, TELEGRAM_BOT_TOKEN, supabase);
      return new Response("OK", { status: 200 });
    }

    // Clear state on new command
    if (text.startsWith("/")) {
      await clearState(supabase, chatId);
      if (text === "/start") {
        await sendMainMenu(chatId, TELEGRAM_BOT_TOKEN, supabase);
      } else {
        await sendMessage(chatId, TELEGRAM_BOT_TOKEN,
          "❓ أمر غير معروف.\nاضغط /start لعرض القائمة الرئيسية."
        );
      }
      return new Response("OK", { status: 200 });
    }

    // Check multi-step flows from DB
    const state = await getState(supabase, chatId);

    if (state?.step === "awaiting_name") {
      if (!text) {
        await sendMessage(chatId, TELEGRAM_BOT_TOKEN, "⚠️ أدخل اسمك الكامل:");
        return new Response("OK", { status: 200 });
      }
      await setState(supabase, chatId, "awaiting_email", { name: text });
      await sendMessage(chatId, TELEGRAM_BOT_TOKEN,
        "📧 *أدخل بريدك الإلكتروني:*\n\nمثال: `example@email.com`",
        "Markdown"
      );
      return new Response("OK", { status: 200 });
    }

    if (state?.step === "awaiting_email") {
      if (!text.includes("@") || !text.includes(".")) {
        await sendMessage(chatId, TELEGRAM_BOT_TOKEN, "❌ بريد إلكتروني غير صحيح. حاول مرة أخرى:");
        return new Response("OK", { status: 200 });
      }
      // Check email validity first, then ask for days
      await handleRegistrationEmailStep(supabase, chatId, state.data?.name, text.toLowerCase(), TELEGRAM_BOT_TOKEN);
      return new Response("OK", { status: 200 });
    }

    if (state?.step === "awaiting_reg_days") {
      if (/^\d+$/.test(text)) {
        const days = parseInt(text);
        if (days < 1 || days > 365) {
          await sendMessage(chatId, TELEGRAM_BOT_TOKEN, "⚠️ يرجى إدخال عدد أيام بين 1 و 365:");
          return new Response("OK", { status: 200 });
        }
        await handleRegDaysInput(supabase, chatId, days, state.data, TELEGRAM_BOT_TOKEN);
        return new Response("OK", { status: 200 });
      }
      await sendMessage(chatId, TELEGRAM_BOT_TOKEN, "⚠️ أدخل رقم صحيح (عدد الأيام):");
      return new Response("OK", { status: 200 });
    }

    if (state?.step === "awaiting_reg_receipt") {
      await handleRegReceiptSubmit(supabase, chatId, text, photo, state.data, TELEGRAM_BOT_TOKEN);
      await clearState(supabase, chatId);
      return new Response("OK", { status: 200 });
    }

    if (state?.step === "awaiting_link_email") {
      if (!text.includes("@") || !text.includes(".")) {
        await sendMessage(chatId, TELEGRAM_BOT_TOKEN, "❌ بريد إلكتروني غير صحيح. حاول مرة أخرى:");
        return new Response("OK", { status: 200 });
      }
      await handleLinkAccount(supabase, chatId, text.toLowerCase(), TELEGRAM_BOT_TOKEN);
      await clearState(supabase, chatId);
      return new Response("OK", { status: 200 });
    }

    if (state?.step === "awaiting_rustdesk_id") {
      const rdId = text.trim().replace(/\s+/g, "");
      if (!rdId || rdId.length < 6) {
        await sendMessage(chatId, TELEGRAM_BOT_TOKEN, "⚠️ الـ ID يبدو غير صحيح. أرسل الـ ID من برنامج RustDesk:");
        return new Response("OK", { status: 200 });
      }
      await handleRustDeskIdInput(supabase, chatId, rdId, state.data?.deviceLabel, TELEGRAM_BOT_TOKEN);
      await clearState(supabase, chatId);
      return new Response("OK", { status: 200 });
    }

    if (state?.step === "awaiting_rustdesk_label") {
      const label = text.trim() || null;
      await setState(supabase, chatId, "awaiting_rustdesk_id", { deviceLabel: label });
      await sendMessage(chatId, TELEGRAM_BOT_TOKEN,
        "━━━━━━━━━━━━━━━━━━━━━\n" +
        "🖥️ *أرسل الآن ID جهازك من برنامج RustDesk*\n" +
        "━━━━━━━━━━━━━━━━━━━━━\n\n" +
        "افتح برنامج RustDesk على جهازك وأرسل الرقم الظاهر في الواجهة الرئيسية.\n\n" +
        "مثال: `123456789`",
        "Markdown"
      );
      return new Response("OK", { status: 200 });
    }

    if (state?.step === "awaiting_rustdesk_edit_label") {
      const newLabel = text.trim() === "." ? state.data?.oldLabel : (text.trim() || null);
      await setState(supabase, chatId, "awaiting_rustdesk_edit_id", {
        deviceId: state.data?.deviceId,
        oldId: state.data?.oldId,
        newLabel,
      });
      await sendMessage(chatId, TELEGRAM_BOT_TOKEN,
        "━━━━━━━━━━━━━━━━━━━━━\n" +
        "🔢 *أرسل ID الجهاز الجديد*\n" +
        "━━━━━━━━━━━━━━━━━━━━━\n\n" +
        `الحالي: \`${state.data?.oldId}\`\n\n` +
        "_(أو أرسل `.` للإبقاء على نفس الـ ID)_",
        "Markdown"
      );
      return new Response("OK", { status: 200 });
    }

    if (state?.step === "awaiting_rustdesk_edit_id") {
      const rawId = text.trim().replace(/\s+/g, "");
      const newId = rawId === "." ? state.data?.oldId : rawId;
      if (!newId || newId.length < 6) {
        await sendMessage(chatId, TELEGRAM_BOT_TOKEN, "⚠️ الـ ID يبدو غير صحيح. أرسل الـ ID أو أرسل `.` للإبقاء:");
        return new Response("OK", { status: 200 });
      }
      await handleRustDeskEditDevice(supabase, chatId, state.data?.deviceId, newId, state.data?.newLabel, TELEGRAM_BOT_TOKEN);
      await clearState(supabase, chatId);
      return new Response("OK", { status: 200 });
    }

    if (state?.step === "awaiting_days") {
      if (/^\d+$/.test(text)) {
        await handleDaysInput(supabase, chatId, parseInt(text), state.data?.licenseKey, TELEGRAM_BOT_TOKEN);
        // Don't clear state yet - next step is awaiting_receipt (set inside handleDaysInput)
        return new Response("OK", { status: 200 });
      }
      await sendMessage(chatId, TELEGRAM_BOT_TOKEN, "⚠️ أدخل رقم صحيح (عدد الأيام):");
      return new Response("OK", { status: 200 });
    }

    if (state?.step === "awaiting_receipt") {
      await handleReceiptSubmit(supabase, chatId, text, photo, state.data?.renewalRequestId, TELEGRAM_BOT_TOKEN);
      await clearState(supabase, chatId);
      return new Response("OK", { status: 200 });
    }

    // No state - greet automatically as if they pressed /start
    await sendMainMenu(chatId, TELEGRAM_BOT_TOKEN, supabase);
  } catch (error) {
    console.error("Telegram bot error:", error);
  }

  return new Response("OK", { status: 200 });
});

// ─── State Management (DB-backed) ─────────────────────
async function getState(supabase: any, chatId: number) {
  const { data } = await supabase
    .from("telegram_user_states")
    .select("step, data")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  return data;
}

async function setState(supabase: any, chatId: number, step: string, data: any = {}) {
  await supabase
    .from("telegram_user_states")
    .upsert({ telegram_chat_id: chatId, step, data, updated_at: new Date().toISOString() });
}

async function clearState(supabase: any, chatId: number) {
  await supabase
    .from("telegram_user_states")
    .delete()
    .eq("telegram_chat_id", chatId);
}

// ─── Location Handling (Optional) ──────────────────────
async function sendLocationRequestKeyboard(chatId: number, token: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text:
        "━━━━━━━━━━━━━━━━━━━━━\n" +
        "📍 *مشاركة الموقع الجغرافي*\n" +
        "━━━━━━━━━━━━━━━━━━━━━\n\n" +
        "هذه الميزة متاحة فقط من *تطبيق الهاتف* 📱\n\n" +
        "اضغط الزر أدناه لمشاركة موقعك (اختياري):",
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [[{ text: "📍 مشاركة موقعي", request_location: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }),
  });
}

async function handleLocationReceived(supabase: any, chatId: number, latitude: number, longitude: number, token: string) {
  // Save location to telegram_links if link exists, otherwise just store in state for later
  const { data: existingLink } = await supabase
    .from("telegram_links")
    .select("id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (existingLink) {
    await supabase
      .from("telegram_links")
      .update({
        latitude,
        longitude,
        location_updated_at: new Date().toISOString(),
      })
      .eq("telegram_chat_id", chatId);
  } else {
    // Store in state until they link/register
    await supabase
      .from("telegram_user_states")
      .upsert({
        telegram_chat_id: chatId,
        step: "has_location",
        data: { latitude, longitude },
        updated_at: new Date().toISOString(),
      });
  }

  // Remove the location keyboard and proceed to main menu
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "✅ *تم حفظ موقعك بنجاح!*",
      parse_mode: "Markdown",
      reply_markup: { remove_keyboard: true },
    }),
  });

  await sendMainMenu(chatId, token, supabase);
}

// ─── Main Menu ─────────────────────────────────────────
async function sendMainMenu(chatId: number, token: string, supabase?: any) {
  // Check if this chat is already linked to a customer
  let isLinked = false;
  let customerName = "";
  if (supabase) {
    const { data: link } = await supabase
      .from("telegram_links")
      .select("customer_id, customers(name)")
      .eq("telegram_chat_id", chatId)
      .maybeSingle();
    if (link) {
      isLinked = true;
      customerName = link.customers?.name || "";
    }
  }

  if (isLinked) {
    // Registered user menu - no register/link buttons
    const keyboard = {
      inline_keyboard: [
        [{ text: "📋 عرض تراخيصي", callback_data: "my_licenses" }],
        [{ text: "🔄 تجديد ترخيص", callback_data: "renew" }],
        [{ text: "🔑 ريسيت المفتاح (مسح الأجهزة)", callback_data: "reset_key" }],
        [{ text: "🖥️ تسجيل / تعديل ID جهاز", callback_data: "rustdesk_register" }],
        [{ text: "⬇️ تحميل RustDesk", callback_data: "download_rustdesk" }],
        [{ text: "📍 مشاركة موقعي (اختياري)", callback_data: "share_location" }],
        [{ text: "❓ المساعدة", callback_data: "help" }],
      ],
    };
    await sendMessageWithKeyboard(chatId, token,
      "━━━━━━━━━━━━━━━━━━━━━\n" +
      `🤖 *أهلاً ${customerName}!*\n` +
      "━━━━━━━━━━━━━━━━━━━━━\n\n" +
      "اختر من القائمة أدناه:\n",
      keyboard,
      "Markdown"
    );
  } else {
    // Unregistered user menu
    const keyboard = {
      inline_keyboard: [
        [{ text: "📝 تسجيل مستخدم جديد", callback_data: "register" }],
        [{ text: "🔗 ربط حساب موجود", callback_data: "link_account" }],
        [{ text: "❓ المساعدة", callback_data: "help" }],
      ],
    };
    await sendMessageWithKeyboard(chatId, token,
      "━━━━━━━━━━━━━━━━━━━━━\n" +
      "🤖 *أهلاً وسهلاً بك!*\n" +
      "━━━━━━━━━━━━━━━━━━━━━\n\n" +
      "اختر من القائمة أدناه:\n",
      keyboard,
      "Markdown"
    );
  }
}

// ─── Callback Query Handler ────────────────────────────
async function handleCallbackQuery(supabase: any, query: any, token: string) {
  const chatId = query.message.chat.id;
  const data = query.data;

  // Answer callback to remove loading state
  await fetch(`${TELEGRAM_API}${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: query.id }),
  });

  switch (data) {
    case "register":
      await handleRegisterStart(supabase, chatId, token);
      break;
    case "link_account":
      await handleLinkStart(supabase, chatId, token);
      break;
    case "my_licenses":
      await handleLicenses(supabase, chatId, token);
      break;
    case "renew":
      await handleRenewStart(supabase, chatId, token);
      break;
    case "reset_key":
      await handleResetKeyStart(supabase, chatId, token);
      break;
    case "help":
      await handleHelp(chatId, token);
      break;
    case "main_menu":
      await clearState(supabase, chatId);
      await sendMainMenu(chatId, token, supabase);
      break;
    case "rustdesk_register":
      await handleRustDeskRegister(supabase, chatId, token);
      break;
    case "rustdesk_add_new":
      await handleRustDeskAddNew(supabase, chatId, token);
      break;
    case "download_rustdesk":
      await handleDownloadRustDesk(chatId, token);
      break;
    case "share_location":
      await sendLocationRequestKeyboard(chatId, token);
      break;
    default:
      if (data.startsWith("renew_")) {
        const licenseKey = data.replace("renew_", "");
        await handleRenewLicense(supabase, chatId, licenseKey, token);
      } else if (data.startsWith("reset_confirm_")) {
        const licenseId = data.replace("reset_confirm_", "");
        await handleResetKeyConfirm(supabase, chatId, licenseId, token);
      } else if (data.startsWith("rustdesk_delete_")) {
        const deviceId = data.replace("rustdesk_delete_", "");
        await handleRustDeskDeleteDevice(supabase, chatId, deviceId, token);
      } else if (data.startsWith("rustdesk_edit_")) {
        const deviceId = data.replace("rustdesk_edit_", "");
        await handleRustDeskEditStart(supabase, chatId, deviceId, token);
      }
      break;
  }
}

// ─── Registration Flow ─────────────────────────────────
async function handleRegisterStart(supabase: any, chatId: number, token: string) {
  await setState(supabase, chatId, "awaiting_name");
  await sendMessage(chatId, token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "📝 *تسجيل مستخدم جديد*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    "👤 *أدخل اسمك الكامل:*",
    "Markdown"
  );
}

// Step 2: validate email, check duplicates, then ask for days
async function handleRegistrationEmailStep(supabase: any, chatId: number, name: string, email: string, token: string) {
  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (existingCustomer) {
    await sendMessageWithKeyboard(chatId, token,
      "⚠️ يوجد حساب بالفعل بهذا البريد الإلكتروني.\n\n" +
      "إذا كنت تريد ربط حسابك، اضغط الزر أدناه:",
      { inline_keyboard: [[{ text: "🔗 ربط حساب موجود", callback_data: "link_account" }], [{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] }
    );
    await clearState(supabase, chatId);
    return;
  }

  const { data: existingReq } = await supabase
    .from("registration_requests")
    .select("id")
    .ilike("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (existingReq) {
    await sendMessageWithKeyboard(chatId, token,
      "⏳ يوجد طلب تسجيل قيد المراجعة بالفعل لهذا البريد.\nسيتم إبلاغك فور الموافقة.",
      { inline_keyboard: [[{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] }
    );
    await clearState(supabase, chatId);
    return;
  }

  // Email is valid — move to asking for days
  await setState(supabase, chatId, "awaiting_reg_days", { name, email });
  await sendMessage(chatId, token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "📅 *كم يوم تريد الاشتراك؟*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    "💰 *الأسعار:*\n" +
    "• اليوم = 10 جنيه\n" +
    "• 30 يوم = 300 جنيه\n\n" +
    "أرسل عدد الأيام (مثال: `30`)\n" +
    "━━━━━━━━━━━━━━━━━━━━━",
    "Markdown"
  );
}

// Step 3: receive days, show payment instructions, ask for receipt
async function handleRegDaysInput(supabase: any, chatId: number, days: number, stateData: any, token: string) {
  const amount = days * PRICE_PER_DAY;
  await setState(supabase, chatId, "awaiting_reg_receipt", { ...stateData, days, amount });
  await sendMessage(chatId, token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "💰 *تفاصيل الاشتراك*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    `📅 عدد الأيام: *${days} يوم*\n` +
    `💵 المبلغ: *${amount} جنيه*\n\n` +
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "📱 *خطوات الدفع:*\n\n" +
    `1️⃣ حوّل *${amount} جنيه* على:\n` +
    `📞 \`${PAYMENT_NUMBER}\`\n` +
    "_(فودافون كاش)_\n\n" +
    "2️⃣ أرسل *صورة الإيصال* أو *رقم العملية* الآن 👇\n\n" +
    "━━━━━━━━━━━━━━━━━━━━━",
    "Markdown"
  );
}

// Step 4: receive receipt, save registration request
async function handleRegReceiptSubmit(supabase: any, chatId: number, text: string, photo: any[] | undefined, stateData: any, token: string) {
  const { name, email, days, amount } = stateData || {};

  if (!name || !email || !days) {
    await sendMessage(chatId, token, "❌ حدث خطأ. ابدأ من جديد بالضغط /start");
    return;
  }

  let receiptNote = "";
  if (photo && photo.length > 0) {
    const bestPhoto = photo[photo.length - 1];
    receiptNote = `[صورة إيصال] file_id: ${bestPhoto.file_id}`;
    if (text) receiptNote += `\nملاحظة: ${text}`;
  } else if (text) {
    receiptNote = text;
  } else {
    await sendMessage(chatId, token, "⚠️ أرسل صورة الإيصال أو رقم العملية:");
    // re-enter state so they can send again
    await setState(supabase, chatId, "awaiting_reg_receipt", stateData);
    return;
  }

  const { error } = await supabase
    .from("registration_requests")
    .insert({
      telegram_chat_id: chatId,
      name,
      email,
      status: "pending",
      requested_days: days,
      amount,
      receipt_note: receiptNote,
    });

  if (error) {
    console.error("Registration request error:", error);
    await sendMessage(chatId, token, "❌ حدث خطأ. حاول لاحقاً.");
    return;
  }

  const isPhoto = photo && photo.length > 0;

  // Notify admin
  await notifyAdmin(token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "🆕 *طلب تسجيل جديد!*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    `👤 الاسم: *${name}*\n` +
    `📧 البريد: *${email}*\n` +
    `📅 الأيام: *${days} يوم*\n` +
    `💵 المبلغ: *${amount} جنيه*\n` +
    `📎 الإيصال: ${isPhoto ? "صورة 🖼️" : "نص 📝"}\n\n` +
    "⚡ افتح لوحة التحكم للموافقة أو الرفض\n" +
    "━━━━━━━━━━━━━━━━━━━━━"
  );

  await sendMessageWithKeyboard(chatId, token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "✅ *تم إرسال طلب التسجيل بنجاح!*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    `👤 الاسم: *${name}*\n` +
    `📧 البريد: *${email}*\n` +
    `📅 الأيام المطلوبة: *${days} يوم*\n` +
    `💵 المبلغ: *${amount} جنيه*\n\n` +
    "⏳ سيتم مراجعة طلبك من الإدارة.\n" +
    "سيتم إبلاغك فور التفعيل ✅",
    { inline_keyboard: [[{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] },
    "Markdown"
  );
}

// ─── Link Account Flow ─────────────────────────────────
async function handleLinkStart(supabase: any, chatId: number, token: string) {
  await setState(supabase, chatId, "awaiting_link_email");
  await sendMessage(chatId, token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "🔗 *ربط حساب موجود*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    "📧 *أدخل بريدك الإلكتروني المسجّل:*\n\n" +
    "مثال: `example@email.com`",
    "Markdown"
  );
}

async function handleLinkAccount(supabase: any, chatId: number, email: string, token: string) {
  const { data: existingLink } = await supabase
    .from("telegram_links")
    .select("id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (existingLink) {
    await sendMessageWithKeyboard(chatId, token,
      "✅ حسابك مربوط بالفعل!",
      { inline_keyboard: [[{ text: "📋 عرض تراخيصي", callback_data: "my_licenses" }], [{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] }
    );
    return;
  }

  // Search in customers table first (case-insensitive)
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name")
    .ilike("email", email)
    .maybeSingle();

  if (customer) {
    // Check if already linked to another chat
    const { data: existingCustLink } = await supabase
      .from("telegram_links")
      .select("id")
      .eq("customer_id", customer.id)
      .maybeSingle();

    if (existingCustLink) {
      await sendMessageWithKeyboard(chatId, token,
        "⚠️ هذا الحساب مربوط بمستخدم آخر بالفعل.\n\nإذا كنت تواجه مشكلة، تواصل مع الدعم.",
        { inline_keyboard: [[{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] }
      );
      return;
    }

    // Retrieve location from state if saved earlier
    const { data: locState } = await supabase
      .from("telegram_user_states")
      .select("data")
      .eq("telegram_chat_id", chatId)
      .eq("step", "has_location")
      .maybeSingle();

    const insertData: any = { customer_id: customer.id, telegram_chat_id: chatId };
    if (locState?.data?.latitude) {
      insertData.latitude = locState.data.latitude;
      insertData.longitude = locState.data.longitude;
      insertData.location_updated_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("telegram_links")
      .insert(insertData);

    if (error) {
      console.error("Error linking:", error);
      await sendMessage(chatId, token, "❌ حدث خطأ. حاول مرة أخرى.");
      return;
    }

    await sendMessageWithKeyboard(chatId, token,
      "━━━━━━━━━━━━━━━━━━━━━\n" +
      `✅ *تم ربط حسابك بنجاح!*\n\n` +
      `👤 مرحباً *${customer.name}*\n` +
      "━━━━━━━━━━━━━━━━━━━━━",
      { inline_keyboard: [[{ text: "📋 عرض تراخيصي", callback_data: "my_licenses" }], [{ text: "🔄 تجديد ترخيص", callback_data: "renew" }], [{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] },
      "Markdown"
    );
    return;
  }

  // Not found in customers - check if there's a pending/approved registration request
  const { data: regReq } = await supabase
    .from("registration_requests")
    .select("id, name, status")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (regReq) {
    if (regReq.status === "pending") {
      await sendMessageWithKeyboard(chatId, token,
        "⏳ *طلب تسجيلك قيد المراجعة*\n\nسيتم إبلاغك فور الموافقة عليه من الإدارة.",
        { inline_keyboard: [[{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] },
        "Markdown"
      );
    } else if (regReq.status === "rejected") {
      await sendMessageWithKeyboard(chatId, token,
        "❌ *تم رفض طلب تسجيلك سابقاً*\n\nيمكنك التسجيل مجدداً أو التواصل مع الدعم.",
        { inline_keyboard: [[{ text: "📝 تسجيل مستخدم جديد", callback_data: "register" }], [{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] },
        "Markdown"
      );
    } else {
      // Approved but customer not yet created - shouldn't happen, inform admin
      await sendMessageWithKeyboard(chatId, token,
        "✅ تمت الموافقة على طلبك لكن الحساب لم يُنشأ بعد.\nتواصل مع الدعم.",
        { inline_keyboard: [[{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] }
      );
    }
    return;
  }

  // No record found at all
  await sendMessageWithKeyboard(chatId, token,
    "❌ *لم يتم العثور على حساب بهذا البريد*\n\n" +
    "تأكد من البريد الإلكتروني أو سجّل كمستخدم جديد:",
    { inline_keyboard: [[{ text: "📝 تسجيل مستخدم جديد", callback_data: "register" }], [{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] },
    "Markdown"
  );
}

// ─── View Licenses ─────────────────────────────────────
async function handleLicenses(supabase: any, chatId: number, token: string) {
  const customer = await getCustomerByChatId(supabase, chatId);
  if (!customer) {
    await sendMessageWithKeyboard(chatId, token,
      "⚠️ حسابك غير مربوط بعد.",
      { inline_keyboard: [[{ text: "🔗 ربط حساب", callback_data: "link_account" }], [{ text: "📝 تسجيل جديد", callback_data: "register" }], [{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] }
    );
    return;
  }

  const { data: licenses } = await supabase
    .from("licenses")
    .select("id, license_key, status, expire_at, max_devices, products(name)")
    .eq("customer_id", customer.customer_id);

  if (!licenses || licenses.length === 0) {
    await sendMessageWithKeyboard(chatId, token,
      "📋 لا توجد تراخيص مسجلة على حسابك.",
      { inline_keyboard: [[{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] }
    );
    return;
  }

  const statusEmoji: Record<string, string> = { active: "🟢", expired: "🔴", suspended: "🟡", pending: "⚪" };
  const statusAr: Record<string, string> = { active: "نشط", expired: "منتهي", suspended: "معلق", pending: "قيد الانتظار" };

  let msg = "━━━━━━━━━━━━━━━━━━━━━\n📋 *تراخيصك:*\n━━━━━━━━━━━━━━━━━━━━━\n\n";
  licenses.forEach((l: any, i: number) => {
    const emoji = statusEmoji[l.status] || "⚪";
    const status = statusAr[l.status] || l.status;
    const expiry = l.expire_at ? new Date(l.expire_at).toLocaleDateString("ar-EG") : "غير محدد";
    const daysLeft = l.expire_at ? Math.ceil((new Date(l.expire_at).getTime() - Date.now()) / 86400000) : null;

    msg += `${i + 1}. ${emoji} *${l.products?.name || "منتج"}*\n`;
    msg += `   📊 الحالة: ${status}\n`;
    msg += `   📅 ينتهي: ${expiry}`;
    if (daysLeft !== null && daysLeft > 0 && daysLeft <= 30) {
      msg += ` ⚠️ (${daysLeft} يوم)`;
    }
    msg += "\n\n";
    msg += `   🔑 انسخ المفتاح:\n   \`${l.license_key}\`\n\n`;
  });

  const buttons = licenses
    .filter((l: any) => l.status === "active" || l.status === "expired")
    .map((l: any) => [{ text: `🔄 تجديد ${l.products?.name || "ترخيص"}`, callback_data: `renew_${l.license_key}` }]);

  buttons.push([{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]);

  await sendMessageWithKeyboard(chatId, token, msg, { inline_keyboard: buttons }, "Markdown");
}

// ─── Renew Flow ────────────────────────────────────────
async function handleRenewStart(supabase: any, chatId: number, token: string) {
  const customer = await getCustomerByChatId(supabase, chatId);
  if (!customer) {
    await sendMessageWithKeyboard(chatId, token,
      "⚠️ حسابك غير مربوط بعد.",
      { inline_keyboard: [[{ text: "🔗 ربط حساب", callback_data: "link_account" }], [{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] }
    );
    return;
  }

  const { data: licenses } = await supabase
    .from("licenses")
    .select("id, license_key, status, expire_at, products(name)")
    .eq("customer_id", customer.customer_id);

  if (!licenses || licenses.length === 0) {
    await sendMessageWithKeyboard(chatId, token,
      "📋 لا توجد تراخيص لتجديدها.",
      { inline_keyboard: [[{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] }
    );
    return;
  }

  const buttons = licenses.map((l: any) => {
    const statusEmoji = l.status === "active" ? "🟢" : l.status === "expired" ? "🔴" : "⚪";
    return [{ text: `${statusEmoji} ${l.products?.name || "ترخيص"} - ${l.license_key}`, callback_data: `renew_${l.license_key}` }];
  });
  buttons.push([{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]);

  await sendMessageWithKeyboard(chatId, token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "🔄 *اختر الترخيص للتجديد:*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    "💰 السعر: *10 جنيه / يوم*\n" +
    "📦 الشهر (30 يوم): *300 جنيه*",
    { inline_keyboard: buttons },
    "Markdown"
  );
}

async function handleRenewLicense(supabase: any, chatId: number, licenseKey: string, token: string) {
  const customer = await getCustomerByChatId(supabase, chatId);
  if (!customer) return;

  const { data: license } = await supabase
    .from("licenses")
    .select("id, license_key, status, expire_at, products(name)")
    .eq("customer_id", customer.customer_id)
    .eq("license_key", licenseKey.toUpperCase())
    .maybeSingle();

  if (!license) {
    await sendMessage(chatId, token, "❌ لم يتم العثور على الترخيص.");
    return;
  }

  await setState(supabase, chatId, "awaiting_days", { licenseKey: license.license_key });

  await sendMessage(chatId, token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "🔄 *تجديد الترخيص*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    `🔑 المنتج: *${license.products?.name || "منتج"}*\n` +
    `📅 ينتهي: ${license.expire_at ? new Date(license.expire_at).toLocaleDateString("ar-EG") : "منتهي"}\n\n` +
    "💰 *الأسعار:*\n" +
    "• اليوم = 10 جنيه\n" +
    "• 30 يوم = 300 جنيه\n\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "📝 *كم يوم تريد تجديد؟*\n" +
    "أرسل عدد الأيام (مثال: `30`)\n" +
    "━━━━━━━━━━━━━━━━━━━━━",
    "Markdown"
  );
}

async function handleDaysInput(supabase: any, chatId: number, days: number, licenseKey: string, token: string) {
  if (days < 1 || days > 365) {
    await sendMessage(chatId, token, "⚠️ يرجى إدخال عدد أيام بين 1 و 365.");
    return;
  }

  const customer = await getCustomerByChatId(supabase, chatId);
  if (!customer) return;

  const amount = days * PRICE_PER_DAY;

  const { data: license } = await supabase
    .from("licenses")
    .select("id, products(name)")
    .eq("customer_id", customer.customer_id)
    .eq("license_key", licenseKey.toUpperCase())
    .maybeSingle();

  if (!license) {
    await sendMessage(chatId, token, "❌ حدث خطأ. حاول مرة أخرى.");
    return;
  }

  const { data: renewalData, error } = await supabase
    .from("renewal_requests")
    .insert({
      customer_id: customer.customer_id,
      license_id: license.id,
      days,
      amount,
      status: "pending",
      telegram_chat_id: chatId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Renewal request error:", error);
    await sendMessage(chatId, token, "❌ حدث خطأ. حاول لاحقاً.");
    return;
  }

  // Set state to awaiting receipt
  await setState(supabase, chatId, "awaiting_receipt", { renewalRequestId: renewalData.id });

  // Notify admin
  const { data: customerInfo } = await supabase.from("customers").select("name").eq("id", customer.customer_id).maybeSingle();
  await notifyAdmin(token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "🔔 *طلب تجديد جديد!*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    `👤 العميل: *${customerInfo?.name || "غير معروف"}*\n` +
    `🔑 المنتج: *${license.products?.name || "منتج"}*\n` +
    `📅 الأيام: *${days} يوم*\n` +
    `💵 المبلغ: *${amount} جنيه*\n\n` +
    "⏳ في انتظار إيصال الدفع...\n" +
    "━━━━━━━━━━━━━━━━━━━━━"
  );

  await sendMessage(chatId, token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "💰 *تفاصيل طلب التجديد*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    `🔑 المنتج: *${license.products?.name || "منتج"}*\n` +
    `📅 عدد الأيام: *${days} يوم*\n` +
    `💵 المبلغ: *${amount} جنيه*\n\n` +
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "📱 *خطوات الدفع:*\n\n" +
    `1️⃣ حوّل *${amount} جنيه* على:\n` +
    `📞 \`${PAYMENT_NUMBER}\`\n` +
    "_(فودافون كاش)_\n\n" +
    "2️⃣ أرسل *صورة الإيصال* أو *رقم العملية* الآن 👇\n\n" +
    "3️⃣ سيتم مراجعة طلبك وتأكيده\n\n" +
    "4️⃣ بمجرد التأكيد، يتم التجديد تلقائياً ✅\n\n" +
    "━━━━━━━━━━━━━━━━━━━━━",
    "Markdown"
  );
}

async function handleReceiptSubmit(
  supabase: any,
  chatId: number,
  text: string,
  photo: any[] | undefined,
  renewalRequestId: string,
  token: string
) {
  if (!renewalRequestId) {
    await sendMessage(chatId, token, "❌ حدث خطأ. حاول /start من جديد.");
    return;
  }

  let receiptNote = "";

  if (photo && photo.length > 0) {
    // Get the largest photo file_id
    const bestPhoto = photo[photo.length - 1];
    receiptNote = `[صورة إيصال] file_id: ${bestPhoto.file_id}`;
    if (text) receiptNote += `\nملاحظة: ${text}`;
  } else if (text) {
    receiptNote = text;
  } else {
    await sendMessage(chatId, token, "⚠️ أرسل صورة الإيصال أو رقم العملية:");
    return;
  }

  const { error } = await supabase
    .from("renewal_requests")
    .update({ receipt_note: receiptNote })
    .eq("id", renewalRequestId);

  if (error) {
    console.error("Receipt update error:", error);
    await sendMessage(chatId, token, "❌ حدث خطأ في حفظ الإيصال. حاول مرة أخرى.");
    return;
  }

  // Fetch renewal request details for admin notification
  const { data: renewalReq } = await supabase
    .from("renewal_requests")
    .select("days, amount, licenses(products(name)), customers(name)")
    .eq("id", renewalRequestId)
    .maybeSingle();

  const isPhoto = photo && photo.length > 0;
  await notifyAdmin(token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "💳 *تم استلام إيصال دفع!*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    `👤 العميل: *${renewalReq?.customers?.name || "غير معروف"}*\n` +
    `🔑 المنتج: *${renewalReq?.licenses?.products?.name || "منتج"}*\n` +
    `📅 الأيام: *${renewalReq?.days || "?"} يوم*\n` +
    `💵 المبلغ: *${renewalReq?.amount || "?"} جنيه*\n` +
    `📎 نوع الإيصال: ${isPhoto ? "صورة 🖼️" : "نص 📝"}\n\n` +
    "⚡ افتح لوحة التحكم لمراجعة الطلب والتأكيد\n" +
    "━━━━━━━━━━━━━━━━━━━━━"
  );

  await sendMessageWithKeyboard(chatId, token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "✅ *تم استلام إيصال الدفع!*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    "📨 سيتم مراجعة طلبك من الإدارة\n" +
    "وسيصلك إشعار بالتأكيد قريباً ✅",
    { inline_keyboard: [[{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] },
    "Markdown"
  );
}

// ─── RustDesk ID Flow ──────────────────────────────────
async function handleRustDeskRegister(supabase: any, chatId: number, token: string) {
  const customer = await getCustomerByChatId(supabase, chatId);
  if (!customer) {
    await sendMessageWithKeyboard(chatId, token,
      "⚠️ حسابك غير مربوط بعد.",
      { inline_keyboard: [[{ text: "🔗 ربط حساب", callback_data: "link_account" }], [{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] }
    );
    return;
  }

  // Fetch all existing devices for this customer
  const { data: devices } = await supabase
    .from("rustdesk_ids")
    .select("id, rustdesk_id, device_label")
    .eq("customer_id", customer.customer_id)
    .order("created_at", { ascending: true });

  let existingMsg = "";
  const buttons: any[] = [];

  if (devices && devices.length > 0) {
    existingMsg = "📋 *أجهزتك المسجّلة:*\n";
    devices.forEach((d: any, i: number) => {
      existingMsg += `${i + 1}. \`${d.rustdesk_id}\`${d.device_label ? ` — ${d.device_label}` : ""}\n`;
      buttons.push([
        { text: `✏️ تعديل: ${d.device_label || d.rustdesk_id}`, callback_data: `rustdesk_edit_${d.id}` },
        { text: `🗑️ حذف`, callback_data: `rustdesk_delete_${d.id}` },
      ]);
    });
    existingMsg += "\n";
  }

  buttons.push([{ text: "➕ إضافة جهاز جديد", callback_data: "rustdesk_add_new" }]);
  buttons.push([{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]);

  await sendMessageWithKeyboard(chatId, token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "🖥️ *إدارة أجهزة RustDesk*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    existingMsg +
    "اختر إجراءً:",
    { inline_keyboard: buttons },
    "Markdown"
  );
}

async function handleRustDeskAddNew(supabase: any, chatId: number, token: string) {
  await setState(supabase, chatId, "awaiting_rustdesk_label");
  await sendMessage(chatId, token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "🖥️ *إضافة جهاز جديد*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    "✏️ *أدخل اسماً مميزاً للجهاز* (اختياري)\n" +
    "مثال: `لابتوب المكتب` أو `جهاز البيت`\n\n" +
    "_(أو أرسل `.` للتخطي)_",
    "Markdown"
  );
}

async function handleRustDeskDeleteDevice(supabase: any, chatId: number, deviceId: string, token: string) {
  const customer = await getCustomerByChatId(supabase, chatId);
  if (!customer) return;

  const { error } = await supabase
    .from("rustdesk_ids")
    .delete()
    .eq("id", deviceId)
    .eq("customer_id", customer.customer_id);

  if (error) {
    await sendMessage(chatId, token, "❌ حدث خطأ أثناء الحذف. حاول مرة أخرى.");
    return;
  }

  await sendMessageWithKeyboard(chatId, token,
    "✅ *تم حذف الجهاز بنجاح!*",
    { inline_keyboard: [[{ text: "🖥️ إدارة الأجهزة", callback_data: "rustdesk_register" }], [{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] },
    "Markdown"
  );
}

async function handleRustDeskEditStart(supabase: any, chatId: number, deviceId: string, token: string) {
  const customer = await getCustomerByChatId(supabase, chatId);
  if (!customer) return;

  const { data: device } = await supabase
    .from("rustdesk_ids")
    .select("rustdesk_id, device_label")
    .eq("id", deviceId)
    .eq("customer_id", customer.customer_id)
    .maybeSingle();

  if (!device) {
    await sendMessage(chatId, token, "❌ الجهاز غير موجود.");
    return;
  }

  await setState(supabase, chatId, "awaiting_rustdesk_edit_label", {
    deviceId,
    oldId: device.rustdesk_id,
    oldLabel: device.device_label,
  });

  await sendMessage(chatId, token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "✏️ *تعديل بيانات الجهاز*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    `🔢 ID الحالي: \`${device.rustdesk_id}\`\n` +
    `🏷️ الاسم الحالي: ${device.device_label || "—"}\n\n` +
    "*أرسل الاسم الجديد للجهاز* (اختياري)\n" +
    "_(أو أرسل `.` للإبقاء على نفس الاسم)_",
    "Markdown"
  );
}

async function handleRustDeskEditDevice(supabase: any, chatId: number, deviceId: string, newId: string, newLabel: string | null, token: string) {
  const customer = await getCustomerByChatId(supabase, chatId);
  if (!customer) return;

  // Check if new ID conflicts with another device (not the same device)
  if (newId) {
    const { data: conflict } = await supabase
      .from("rustdesk_ids")
      .select("id, customer_id")
      .eq("rustdesk_id", newId)
      .neq("id", deviceId)
      .maybeSingle();

    if (conflict) {
      await sendMessage(chatId, token, `⚠️ هذا الـ ID \`${newId}\` مسجّل مسبقاً لجهاز آخر.`, "Markdown");
      return;
    }
  }

  const { error } = await supabase
    .from("rustdesk_ids")
    .update({ rustdesk_id: newId, device_label: newLabel, updated_at: new Date().toISOString() })
    .eq("id", deviceId)
    .eq("customer_id", customer.customer_id);

  if (error) {
    await sendMessage(chatId, token, "❌ حدث خطأ أثناء التعديل. حاول مرة أخرى.");
    return;
  }

  await sendMessageWithKeyboard(chatId, token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "✅ *تم تعديل بيانات الجهاز بنجاح!*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    `🔢 ID الجديد: \`${newId}\`\n` +
    (newLabel ? `🏷️ الاسم الجديد: ${newLabel}\n` : "") +
    "\n🔑 *كلمة المرور للاتصال:* `123456medoissaA`",
    { inline_keyboard: [[{ text: "🖥️ إدارة الأجهزة", callback_data: "rustdesk_register" }], [{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] },
    "Markdown"
  );
}

async function handleRustDeskIdInput(supabase: any, chatId: number, rustdeskId: string, deviceLabel: string | null, token: string) {
  const customer = await getCustomerByChatId(supabase, chatId);
  if (!customer) return;

  const label = deviceLabel === "." ? null : deviceLabel;

  // Check if this rustdesk_id already exists globally
  const { data: existingGlobal } = await supabase
    .from("rustdesk_ids")
    .select("id, customer_id")
    .eq("rustdesk_id", rustdeskId)
    .maybeSingle();

  if (existingGlobal) {
    if (existingGlobal.customer_id === customer.customer_id) {
      await sendMessage(chatId, token, `⚠️ هذا الـ ID \`${rustdeskId}\` مسجّل مسبقاً في أجهزتك.`, "Markdown");
    } else {
      await sendMessage(chatId, token, `⚠️ هذا الـ ID \`${rustdeskId}\` مسجّل لدى عميل آخر. تحقق من الرقم وأعد المحاولة.`, "Markdown");
    }
    return;
  }

  const { error } = await supabase
    .from("rustdesk_ids")
    .insert({ customer_id: customer.customer_id, rustdesk_id: rustdeskId, device_label: label });

  if (error) {
    console.error("RustDesk insert error:", error);
    await sendMessage(chatId, token, "❌ حدث خطأ. حاول مرة أخرى.");
    return;
  }

  await sendMessageWithKeyboard(chatId, token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "✅ *تم حفظ ID الجهاز بنجاح!*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    `🖥️ *ID الجهاز:* \`${rustdeskId}\`\n` +
    (label ? `🏷️ *اسم الجهاز:* ${label}\n` : "") +
    "\n🔑 *كلمة المرور للاتصال:* `123456medoissaA`\n\n" +
    "سيتمكن فريق الدعم من الاتصال بجهازك عند الحاجة ✅",
    { inline_keyboard: [[{ text: "🖥️ إدارة الأجهزة", callback_data: "rustdesk_register" }], [{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] },
    "Markdown"
  );
}

// ─── Reset Key Flow ────────────────────────────────────
async function handleResetKeyStart(supabase: any, chatId: number, token: string) {
  const customer = await getCustomerByChatId(supabase, chatId);
  if (!customer) {
    await sendMessageWithKeyboard(chatId, token,
      "⚠️ حسابك غير مربوط بعد.",
      { inline_keyboard: [[{ text: "🔗 ربط حساب", callback_data: "link_account" }], [{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] }
    );
    return;
  }

  const { data: licenses } = await supabase
    .from("licenses")
    .select("id, license_key, status, products(name)")
    .eq("customer_id", customer.customer_id);

  if (!licenses || licenses.length === 0) {
    await sendMessageWithKeyboard(chatId, token,
      "📋 لا توجد تراخيص على حسابك.",
      { inline_keyboard: [[{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] }
    );
    return;
  }

  // For each license, count linked devices
  const licensesWithDevices = await Promise.all(
    licenses.map(async (l: any) => {
      const { count } = await supabase
        .from("devices")
        .select("*", { count: "exact", head: true })
        .eq("license_id", l.id);
      return { ...l, deviceCount: count || 0 };
    })
  );

  const statusEmoji: Record<string, string> = { active: "🟢", expired: "🔴", suspended: "🟡", pending: "⚪" };

  const buttons = licensesWithDevices.map((l: any) => {
    const emoji = statusEmoji[l.status] || "⚪";
    const devTxt = l.deviceCount > 0 ? ` (${l.deviceCount} جهاز)` : " (لا أجهزة)";
    return [{ text: `${emoji} ${l.products?.name || "ترخيص"}${devTxt} — اضغط للريسيت`, callback_data: `reset_confirm_${l.id}` }];
  });
  buttons.push([{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]);

  await sendMessageWithKeyboard(chatId, token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "🔑 *ريسيت المفتاح*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    "⚠️ سيتم *مسح جميع الأجهزة* المرتبطة بالمفتاح المختار.\n" +
    "بعد الريسيت يمكنك تفعيل المفتاح على أجهزة جديدة.\n\n" +
    "اختر الترخيص:",
    { inline_keyboard: buttons },
    "Markdown"
  );
}

async function handleResetKeyConfirm(supabase: any, chatId: number, licenseId: string, token: string) {
  const customer = await getCustomerByChatId(supabase, chatId);
  if (!customer) return;

  // Verify this license belongs to this customer
  const { data: license } = await supabase
    .from("licenses")
    .select("id, license_key, products(name)")
    .eq("id", licenseId)
    .eq("customer_id", customer.customer_id)
    .maybeSingle();

  if (!license) {
    await sendMessageWithKeyboard(chatId, token,
      "❌ الترخيص غير موجود أو لا يخصك.",
      { inline_keyboard: [[{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] }
    );
    return;
  }

  // Count devices before deleting
  const { count: deviceCount } = await supabase
    .from("devices")
    .select("*", { count: "exact", head: true })
    .eq("license_id", licenseId);

  // Delete all devices linked to this license
  const { error } = await supabase
    .from("devices")
    .delete()
    .eq("license_id", licenseId);

  if (error) {
    console.error("Reset key devices delete error:", error);
    await sendMessageWithKeyboard(chatId, token,
      "❌ حدث خطأ أثناء الريسيت. حاول مرة أخرى.",
      { inline_keyboard: [[{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] }
    );
    return;
  }

  await sendMessageWithKeyboard(chatId, token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "✅ *تم الريسيت بنجاح!*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    `🔑 الترخيص: *${license.products?.name || "ترخيص"}*\n` +
    `🗑️ تم مسح: *${deviceCount || 0} جهاز*\n\n` +
    "يمكنك الآن تفعيل المفتاح على أجهزتك الجديدة ✅\n\n" +
    `\`${license.license_key}\``,
    { inline_keyboard: [[{ text: "📋 عرض تراخيصي", callback_data: "my_licenses" }], [{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] },
    "Markdown"
  );
}

// ─── Help ──────────────────────────────────────────────
async function handleHelp(chatId: number, token: string) {
  await sendMessageWithKeyboard(chatId, token,
    "━━━━━━━━━━━━━━━━━━━━━\n" +
    "❓ *المساعدة*\n" +
    "━━━━━━━━━━━━━━━━━━━━━\n\n" +
    "📝 *تسجيل جديد* - إنشاء حساب جديد\n" +
    "🔗 *ربط حساب* - ربط حساب موجود\n" +
    "📋 *تراخيصي* - عرض تراخيصك ونسخ المفتاح\n" +
    "🔄 *تجديد* - تجديد ترخيص\n\n" +
    "💰 *الأسعار:*\n" +
    "• 10 جنيه / يوم\n" +
    "• 300 جنيه / 30 يوم\n\n" +
    "📞 الدفع عبر فودافون كاش: `" + PAYMENT_NUMBER + "`",
    { inline_keyboard: [[{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]] },
    "Markdown"
  );
}

// ─── Admin Notification ────────────────────────────────
async function notifyAdmin(token: string, message: string) {
  const adminChatId = Deno.env.get("ADMIN_TELEGRAM_CHAT_ID");
  if (!adminChatId) return;
  await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: adminChatId, text: message, parse_mode: "Markdown" }),
  });
}

// ─── Helpers ───────────────────────────────────────────
async function getCustomerByChatId(supabase: any, chatId: number) {
  const { data } = await supabase
    .from("telegram_links")
    .select("customer_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  return data;
}

async function sendMessage(chatId: number, token: string, text: string, parseMode?: string) {
  const body: any = { chat_id: chatId, text };
  if (parseMode) body.parse_mode = parseMode;

  const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("sendMessage failed:", await res.text());
  }
}

async function sendMessageWithKeyboard(chatId: number, token: string, text: string, keyboard: any, parseMode?: string) {
  const body: any = { chat_id: chatId, text, reply_markup: keyboard };
  if (parseMode) body.parse_mode = parseMode;

  const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("sendMessageWithKeyboard failed:", await res.text());
  }
}

// ─── Download RustDesk ─────────────────────────────────
async function handleDownloadRustDesk(chatId: number, token: string) {
  try {
    // Fetch latest release from GitHub API
    const res = await fetch("https://api.github.com/repos/rustdesk/rustdesk/releases/latest", {
      headers: { "User-Agent": "TelegramBot" },
    });
    const release = await res.json();

    const version = release.tag_name || "غير معروف";
    const assets: any[] = release.assets || [];

    // Windows only: prefer x86_64 exe, fallback to any exe
    const windowsExe = assets.find((a: any) =>
      a.name.toLowerCase().endsWith(".exe") && a.name.toLowerCase().includes("x86_64")
    ) || assets.find((a: any) => a.name.toLowerCase().endsWith(".exe"));

    const msg =
      "━━━━━━━━━━━━━━━━━━━━━\n" +
      "⬇️ *تحميل RustDesk*\n" +
      "━━━━━━━━━━━━━━━━━━━━━\n\n" +
      `🏷️ الإصدار الأحدث: *${version}*\n\n` +
      "🪟 اضغط الزر أدناه لتحميل النسخة على Windows:";

    const buttons: any[] = [];

    if (windowsExe) {
      buttons.push([{ text: `🪟 تحميل Windows ${version}`, url: windowsExe.browser_download_url }]);
    } else {
      buttons.push([{ text: "🪟 تحميل من GitHub", url: `https://github.com/rustdesk/rustdesk/releases/tag/${version}` }]);
    }
    buttons.push([{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }]);

    await sendMessageWithKeyboard(chatId, token, msg, { inline_keyboard: buttons }, "Markdown");
  } catch (err) {
    console.error("Failed to fetch RustDesk release:", err);
    await sendMessageWithKeyboard(chatId, token,
      "━━━━━━━━━━━━━━━━━━━━━\n" +
      "⬇️ *تحميل RustDesk*\n" +
      "━━━━━━━━━━━━━━━━━━━━━\n\n" +
      "اضغط الزر أدناه لتحميل أحدث إصدار Windows:",
      {
        inline_keyboard: [
          [{ text: "🪟 تحميل Windows", url: "https://github.com/rustdesk/rustdesk/releases/latest" }],
          [{ text: "🏠 القائمة الرئيسية", callback_data: "main_menu" }],
        ],
      },
      "Markdown"
    );
  }
}

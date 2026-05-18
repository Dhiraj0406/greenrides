"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { ExternalLink, Loader2 } from "lucide-react";

const schema = z.object({
  vehicle_type:   z.enum(["sedan", "suv", "hatchback", "minivan"], { message: "Select a vehicle type" }),
  vehicle_model:  z.string().min(2, "Enter vehicle model"),
  vehicle_number: z.string().min(4, "Enter vehicle number"),
  license_number: z.string().min(4, "Enter licence number"),
  telegram_code:  z.string().length(6, "Code must be 6 digits"),
});

type FormData = z.infer<typeof schema>;

const BOT_NAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || "GreenRidesBot";

export function RegisterForm() {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const inputClass =
    "w-full bg-white border border-border rounded-xl px-4 py-3 text-sm text-text placeholder:text-sub/60 outline-none focus:ring-2 ring-leaf/30";
  const labelClass = "block text-xs font-semibold text-sub mb-1.5 uppercase tracking-wide";
  const errorClass = "text-xs text-red-500 mt-1";

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please log in first"); return; }

      const res = await fetch("/api/drivers/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Registration failed"); return; }

      toast.success("Registration submitted! Waiting for approval.");
      router.push("/drivers/pending");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Telegram linking */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <p className="text-sm font-semibold text-blue-900 mb-2">Step 1 — Link Telegram</p>
        <p className="text-xs text-blue-700 mb-3">
          Open our Telegram bot, send <code>/start</code>, and copy the 6-digit code it gives you.
        </p>
        <a
          href={`https://t.me/${BOT_NAME}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl"
        >
          <ExternalLink className="w-4 h-4" /> Open @{BOT_NAME}
        </a>
      </div>

      <div>
        <label className={labelClass}>Telegram Code</label>
        <input
          {...register("telegram_code")}
          className={inputClass}
          placeholder="6-digit code from bot"
          maxLength={6}
        />
        {errors.telegram_code && <p className={errorClass}>{errors.telegram_code.message}</p>}
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-xs font-semibold text-sub uppercase tracking-wide mb-4">Step 2 — Vehicle Details</p>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Vehicle Type</label>
            <select {...register("vehicle_type")} className={inputClass}>
              <option value="">Select type…</option>
              <option value="sedan">Sedan</option>
              <option value="suv">SUV</option>
              <option value="hatchback">Hatchback</option>
              <option value="minivan">Minivan</option>
            </select>
            {errors.vehicle_type && <p className={errorClass}>{errors.vehicle_type.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Vehicle Model</label>
            <input {...register("vehicle_model")} className={inputClass} placeholder="e.g. Maruti Swift" />
            {errors.vehicle_model && <p className={errorClass}>{errors.vehicle_model.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Vehicle Number</label>
            <input {...register("vehicle_number")} className={inputClass} placeholder="e.g. OD05AB1234" />
            {errors.vehicle_number && <p className={errorClass}>{errors.vehicle_number.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Driving Licence Number</label>
            <input {...register("license_number")} className={inputClass} placeholder="e.g. OD0520220001234" />
            {errors.license_number && <p className={errorClass}>{errors.license_number.message}</p>}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-leaf text-white font-bold py-4 rounded-2xl text-base disabled:opacity-60"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Registration"}
      </button>
    </form>
  );
}

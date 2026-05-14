import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { ArrowLeft, Upload, Save, Loader2, Camera } from "lucide-react";
import { motion } from "motion/react";

export function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(user?.user_metadata?.displayName || user?.email?.split("@")[0] || "");
  const [photoUrl, setPhotoUrl] = useState(user?.user_metadata?.photoURL || `https://ui-avatars.com/api/?name=${user?.email}`);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("profile-photos").getPublicUrl(fileName);
      setPhotoUrl(data.publicUrl);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload photo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          displayName: displayName || user.email?.split("@")[0],
          photoURL: photoUrl,
        },
      });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Update failed:", err);
      alert("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-4">
        <h2 className="text-2xl font-bold mb-4">Please sign in to view your profile</h2>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <header className="flex items-center justify-between mb-12">
        <button 
          onClick={() => navigate("/dashboard")} 
          className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">My Profile</h1>
        <div className="w-10" />
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-12 space-y-8"
      >
        {/* Photo Section */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative group">
            <img
              src={photoUrl}
              alt={displayName}
              className="w-32 h-32 rounded-[2rem] object-cover border-4 border-slate-100 shadow-lg"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 p-3 bg-white rounded-full shadow-lg border-4 border-slate-100 hover:bg-gray-50 transition-all group-hover:scale-110" style={{ backgroundColor: "var(--color-accent)", color: "white" }}
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Click camera to update photo</p>
        </div>

        {/* Display Name Section */}
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:outline-none transition-all text-lg font-bold" style={{ '--focus-ring': 'var(--color-accent)' } as React.CSSProperties}
          />
        </div>

        {/* Email Section (Read-only) */}
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</label>
          <input
            type="email"
            value={user.email || ""}
            disabled
            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 cursor-not-allowed"
          />
          <p className="text-[10px] text-slate-400">Email cannot be changed</p>
        </div>

        {/* Buttons */}
        <div className="flex gap-4 pt-6">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 py-4 text-white rounded-2xl font-black text-lg transition-all active:scale-95 disabled:opacity-50" style={{ backgroundColor: "var(--color-accent)", boxShadow: "0 20px 25px -5px rgba(218, 119, 86, 0.2)" }}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {loading ? "Saving..." : "Save Changes"}
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="flex-1 inline-flex items-center justify-center gap-2 py-4 bg-slate-100 text-slate-900 rounded-2xl font-black text-lg transition-all hover:bg-slate-200 active:scale-95"
          >
            Cancel
          </button>
        </div>

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 font-bold text-center"
          >
            Profile updated successfully!
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

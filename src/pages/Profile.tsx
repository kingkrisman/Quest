import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { ArrowLeft, Save, Loader2, Camera } from "lucide-react";
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-4"
      >
        <motion.h2
          initial={{ y: 10 }}
          animate={{ y: 0 }}
          className="text-xl sm:text-2xl font-bold mb-4 text-slate-900"
        >
          Please sign in to view your profile
        </motion.h2>
      </motion.div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8 md:py-12">
      <div className="max-w-3xl mx-auto w-full">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-2 sm:gap-4 mb-8 sm:mb-10 md:mb-12"
        >
          <motion.button
            onClick={() => navigate("/dashboard")}
            whileHover={{ x: -4 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 -ml-2 text-slate-600 hover:bg-white rounded-lg transition-all"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </motion.button>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex-1 text-center"
          >
            My Profile
          </motion.h1>
          <div className="w-9 sm:w-10" />
        </motion.header>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] border border-slate-200 shadow-sm p-6 sm:p-8 md:p-12 space-y-8 sm:space-y-10"
        >
          {/* Photo Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center space-y-4"
          >
            <div className="relative group">
              <motion.img
                src={photoUrl}
                alt={displayName}
                whileHover={{ scale: 1.05 }}
                className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl sm:rounded-3xl object-cover border-4 border-slate-100 shadow-lg"
              />
              <motion.button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="absolute bottom-0 right-0 p-2 sm:p-3 bg-white rounded-full shadow-lg border-4 border-slate-100 hover:bg-gray-50 transition-all"
                style={{ backgroundColor: "var(--color-accent)", color: "white" }}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </motion.button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-[8px] sm:text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest"
            >
              Click camera to update photo
            </motion.p>
          </motion.div>

          {/* Form Fields */}
          <div className="space-y-6 sm:space-y-8">
            {/* Display Name */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
              className="space-y-2 sm:space-y-3"
            >
              <label className="block text-[8px] sm:text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Display Name
              </label>
              <motion.input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                whileFocus={{ scale: 1.01 }}
                className="w-full px-4 sm:px-5 md:px-6 py-3 sm:py-4 md:py-4 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl md:rounded-2xl focus:ring-2 focus:outline-none transition-all text-base sm:text-lg md:text-lg font-bold"
                style={{ "--focus-ring": "var(--color-accent)" } as React.CSSProperties}
              />
            </motion.div>

            {/* Email (Read-only) */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-2 sm:space-y-3"
            >
              <label className="block text-[8px] sm:text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Email Address
              </label>
              <input
                type="email"
                value={user.email || ""}
                disabled
                className="w-full px-4 sm:px-5 md:px-6 py-3 sm:py-4 md:py-4 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl md:rounded-2xl text-slate-500 cursor-not-allowed text-base sm:text-lg md:text-lg"
              />
              <p className="text-[7px] sm:text-[8px] md:text-[10px] text-slate-400">Email cannot be changed</p>
            </motion.div>
          </div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6 md:pt-8"
          >
            <motion.button
              onClick={handleSave}
              disabled={loading}
              whileHover={!loading ? { scale: 1.02 } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 sm:py-4 md:py-5 px-4 sm:px-6 md:px-8 text-white rounded-lg sm:rounded-xl md:rounded-2xl font-black text-sm sm:text-base md:text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--color-accent)", boxShadow: "0 20px 25px -5px rgba(218, 119, 86, 0.2)" }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  <span className="hidden sm:inline">Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Save Changes</span>
                </>
              )}
            </motion.button>
            <motion.button
              onClick={() => navigate("/dashboard")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 sm:py-4 md:py-5 px-4 sm:px-6 md:px-8 bg-slate-100 text-slate-900 rounded-lg sm:rounded-xl md:rounded-2xl font-black text-sm sm:text-base md:text-lg transition-all hover:bg-slate-200 active:scale-95"
            >
              Cancel
            </motion.button>
          </motion.div>

          {/* Success Message */}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="p-4 sm:p-5 md:p-6 bg-emerald-50 border-2 border-emerald-200 rounded-lg sm:rounded-xl md:rounded-2xl text-emerald-700 font-bold text-center text-sm sm:text-base md:text-lg"
            >
              ✓ Profile updated successfully!
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

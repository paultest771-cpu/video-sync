const SUPABASE_URL = "https://zrgdfupwibzgdnaovccm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyZ2RmdXB3aWJ6Z2RuYW92Y2NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NzM0NzYsImV4cCI6MjA5NTM0OTQ3Nn0.3I9i6oVJrtK259AnfbJUnAcpMi9xplLUXwmFqTx6LSA";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const video = document.getElementById("video");
const upload = document.getElementById("upload");
const progress = document.getElementById("progress");

let isLocalUpdate = false;

/* =========================
   📤 Upload
========================= */
upload.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const fileName = Date.now() + "-" + file.name;

  const { error } = await supabase.storage
    .from("videos")
    .upload(fileName, file, { upsert: true });

  if (error) {
    alert(error.message);
    return;
  }

  const { data } = supabase.storage
    .from("videos")
    .getPublicUrl(fileName);

  await supabase.from("video_state").update({
    video_url: data.publicUrl,
    time: 0,
    is_playing: false
  }).eq("id", 1);

  progress.value = 100;
});

/* =========================
   🎬 Sync
========================= */

video.addEventListener("play", async () => {
  if (isLocalUpdate) return;

  await supabase.from("video_state").update({
    is_playing: true,
    time: video.currentTime
  }).eq("id", 1);
});

video.addEventListener("pause", async () => {
  if (isLocalUpdate) return;

  await supabase.from("video_state").update({
    is_playing: false,
    time: video.currentTime
  }).eq("id", 1);
});

video.addEventListener("seeked", async () => {
  if (isLocalUpdate) return;

  await supabase.from("video_state").update({
    time: video.currentTime
  }).eq("id", 1);
});

/* =========================
   🔄 Realtime
========================= */

supabase
  .channel("video-sync")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "video_state" },
    (payload) => {
      const state = payload.new;

      isLocalUpdate = true;

      if (video.src !== state.video_url) {
        video.src = state.video_url;
      }

      if (Math.abs(video.currentTime - state.time) > 0.5) {
        video.currentTime = state.time;
      }

      if (state.is_playing && video.paused) {
        video.play();
      }

      if (!state.is_playing && !video.paused) {
        video.pause();
      }

      setTimeout(() => {
        isLocalUpdate = false;
      }, 200);
    }
  )
  .subscribe();

/* =========================
   🚀 Initial Load
========================= */

async function init() {
  const { data } = await supabase
    .from("video_state")
    .select("*")
    .eq("id", 1)
    .single();

  if (data?.video_url) {
    video.src = data.video_url;
    video.currentTime = data.time;

    if (data.is_playing) {
      video.play();
    }
  }
}

init();

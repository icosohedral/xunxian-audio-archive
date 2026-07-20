import assert from "node:assert/strict";
import test from "node:test";
import { audioObjectKey, stableAudioIdentity } from "../audio-paths.mjs";

test("stable IDs include the source extension", () => {
  const ogg = stableAudioIdentity("sound/juese_zhujue_houzi_daxiao.ogg");
  const wav = stableAudioIdentity("sound/juese_zhujue_houzi_daxiao.wav");
  assert.notEqual(ogg.id, wav.id);
  assert.match(ogg.id, /^snd_[a-f0-9]{12}$/);
});

test("object keys are versioned, allowlisted, and hash-sharded", () => {
  const key = audioObjectKey("music/xianjie_01.ogg", "opus");
  assert.match(key, /^audio\/v1\/music\/[a-f0-9]{2}\/[a-f0-9]{12}\.opus$/);
  assert.throws(() => audioObjectKey("../secret.wav", "opus"), /Unsupported|Unsafe/);
  assert.throws(() => audioObjectKey("sound/example.flac", "opus"), /Unsupported/);
  assert.throws(() => audioObjectKey("sound/example.wav", "aac"), /Unsupported/);
});

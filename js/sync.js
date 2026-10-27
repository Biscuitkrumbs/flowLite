class FlowSync {
  constructor({ demo, seed, onChange, onStatus }) {
    this.demo = demo;
    this.key = demo ? "flowLiteDemoV3" : "flowLiteSharedV3";
    this.onChange = onChange;
    this.onStatus = onStatus;
    this.base = seed;
    this.pending = [];
    this.ready = demo;
    this.inFlight = null;
    this.revision = -1;
    try {
      const cached = JSON.parse(localStorage.getItem(this.key) || "null");
      if (cached && this.valid(cached.base) && Array.isArray(cached.pending)) {
        this.base = cached.base;
        this.pending = cached.pending;
        this.ready = Boolean(cached.ready);
        this.revision = cached.revision ?? -1;
      }
    } catch (error) { console.warn("Flow cache could not be read", error); }
    this.state = this.preview();
  }

  valid(data) {
    return data && ["cages", "cycles", "events"].every(key => Array.isArray(data[key]));
  }

  persist() {
    localStorage.setItem(this.key, JSON.stringify({ base: this.base, pending: this.pending,
      ready: this.ready, revision: this.revision }));
  }

  remap(aliases) {
    for (const op of this.pending) {
      if (aliases[op.cycleId]) op.cycleId = aliases[op.cycleId];
      if (aliases[op.newCycleId]) op.newCycleId = aliases[op.newCycleId];
    }
  }

  preview() {
    const state = JSON.parse(JSON.stringify(this.base));
    for (const op of this.pending) {
      if (op.error) break;
      try {
        const result = FlowState.transition(state, op, op.createdAt);
        this.remap(result.aliases);
        FlowState.applyPatch(state, result.patch);
      } catch (error) {
        // A pending action may already have committed before its response was lost.
        // Retry its ID on the server before treating a preview conflict as rejection.
        console.info("Pending action awaits server check", error.message);
      }
    }
    return state;
  }

  notify() {
    this.state = this.preview();
    this.onChange(this.state);
  }

  enqueue(operation) {
    if (!this.ready) throw new Error("Connect to shared data before starting. Your existing records have not been changed.");
    if (this.pending.some(op => op.error)) throw new Error("Review the pending change shown at the top before recording another action.");
    const op = { ...operation, id: crypto.randomUUID(), createdAt: Date.now() };
    const result = FlowState.transition(this.state, op, op.createdAt);
    if (this.demo) {
      const previous = this.base;
      this.base = FlowState.applyPatch(JSON.parse(JSON.stringify(this.base)), result.patch);
      try { this.persist(); } catch (error) { this.base = previous; throw new Error("Phone storage is unavailable. This change was not recorded."); }
      this.notify();
      this.onStatus("Demo data · this device only", "demo");
      return;
    }
    this.pending.push(op);
    try { this.persist(); } catch (error) { this.pending.pop(); throw new Error("Phone storage is unavailable. This change was not recorded."); }
    this.notify();
    this.onStatus(`${this.pending.length} pending · saving…`, "pending");
    this.synchronize();
  }

  accept(result) {
    if (!this.valid(result.data)) throw new Error("Shared data could not be read. Pending changes are kept on this phone.");
    if (Number(result.revision) < this.revision) throw new Error("Waiting for the latest shared data.");
    this.base = result.data;
    this.revision = Number(result.revision);
    this.ready = true;
    this.remap(result.aliases || {});
  }

  synchronize() {
    if (this.demo) {
      this.onStatus("Demo data · this device only", "demo");
      return Promise.resolve(true);
    }
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.run().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  async run() {
    try {
      this.onStatus(this.pending.length ? `${this.pending.length} pending · saving…` : "Refreshing shared data…", "pending");
      // Drain saved actions first so ambiguous/lost responses can be retried by ID.
      while (this.pending.length) {
        const op = this.pending[0];
        if (op.error) throw Object.assign(new Error(op.error), { code: "ACTION_REJECTED" });
        const result = await FlowAPI.applyAction(op);
        if (result.actionId !== op.id) throw new Error("The server did not confirm this change. It is kept for retry.");
        this.accept(result);
        this.pending.shift();
        this.persist();
        this.notify();
      }
      this.accept(await FlowAPI.getData());
      this.persist();
      this.notify();
      // A tap can arrive while the final read is in flight. Drain it before
      // declaring the phone synced rather than waiting for the next refresh.
      if (this.pending.length) return this.run();
      this.onStatus("Shared data up to date", "synced");
      return true;
    } catch (error) {
      console.warn("Flow sync", error.message);
      if (error.code === "ACTION_REJECTED" && this.pending[0]) {
        this.pending[0].error = error.message;
        try {
          this.accept(await FlowAPI.getData());
          this.persist();
          this.notify();
        } catch (refreshError) { console.warn("Pending change retained", refreshError.message); }
      }
      const count = this.pending.length;
      this.onStatus(error.code === "ACTION_REJECTED" ? error.message : error.code === "UPGRADE_REQUIRED" ? error.message : count ? `${count} pending · kept on this phone. Tap Retry.` : "Shared connection unavailable. Tap Retry.",
        error.code === "ACTION_REJECTED" ? "conflict" : "failed");
      return false;
    }
  }

  discardRejected() {
    if (!this.pending[0]?.error) return;
    // Keep a local recovery copy; never delete shared records.
    localStorage.setItem(`${this.key}-discarded-${Date.now()}`, JSON.stringify(this.pending));
    this.pending = [];
    this.persist();
    this.notify();
    return this.synchronize();
  }
}

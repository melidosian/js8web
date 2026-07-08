package main

import "sync"

var (
	pendingTxMu    sync.Mutex
	pendingTxQueue []string
	pendingTxCur   string
	pendingTxHave  bool
)

// setPendingTxText queues the text of a message just sent via TX.SEND_MESSAGE.
// Messages are matched to transmissions in send order by advancePendingTxText,
// so queuing (instead of overwriting a single slot) keeps back-to-back sends
// from clobbering each other's text before JS8Call starts transmitting either one.
func setPendingTxText(text string) {
	pendingTxMu.Lock()
	pendingTxQueue = append(pendingTxQueue, text)
	pendingTxMu.Unlock()
}

// advancePendingTxText moves the next queued text into the slot popPendingTxText
// reads from. Call this on the PTT-on edge (start of a new transmission) so each
// transmission picks up its own text rather than whatever was queued most recently.
func advancePendingTxText() {
	pendingTxMu.Lock()
	defer pendingTxMu.Unlock()
	if len(pendingTxQueue) == 0 {
		return
	}
	pendingTxCur = pendingTxQueue[0]
	pendingTxQueue = pendingTxQueue[1:]
	pendingTxHave = true
}

// popPendingTxText returns the current transmission's text on the first call
// after advancePendingTxText, and "" for every subsequent frame of the same
// transmission.
func popPendingTxText() string {
	pendingTxMu.Lock()
	defer pendingTxMu.Unlock()
	if !pendingTxHave {
		return ""
	}
	pendingTxHave = false
	return pendingTxCur
}

package main

import "sync"

var (
	pendingTxMu   sync.Mutex
	pendingTxText string
)

func setPendingTxText(text string) {
	pendingTxMu.Lock()
	pendingTxText = text
	pendingTxMu.Unlock()
}

func popPendingTxText() string {
	pendingTxMu.Lock()
	defer pendingTxMu.Unlock()
	t := pendingTxText
	pendingTxText = ""
	return t
}

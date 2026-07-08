package main

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/PiotrTopa/js8web/model"
)

// GET /api/inbox — returns all inbox messages, newest first
func apiInboxGet(w http.ResponseWriter, req *http.Request, db *sql.DB) {
	messages, err := model.FetchInboxMessages(db)
	if err != nil {
		logger.Sugar().Errorw("Cannot fetch inbox messages", "error", err)
		http.Error(w, "cannot fetch inbox messages", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

type inboxStoreRequest struct {
	Callsign string `json:"callsign"`
	Message  string `json:"message"`
}

// POST /api/inbox — sends INBOX.STORE_MESSAGE to JS8Call
func apiInboxPost(outgoingEvents chan<- model.Js8callEvent) func(http.ResponseWriter, *http.Request, *sql.DB) {
	return func(w http.ResponseWriter, req *http.Request, db *sql.DB) {
		var body inboxStoreRequest
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil || body.Callsign == "" || body.Message == "" {
			http.Error(w, "callsign and message are required", http.StatusBadRequest)
			return
		}

		event := model.Js8callEvent{
			Type:  model.EVENT_TYPE_INBOX_STORE_MESSAGE,
			Value: body.Message,
			Params: model.Js8callEventParams{
				Callsign: body.Callsign,
			},
		}
		select {
		case outgoingEvents <- event:
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]bool{"ok": true})
		default:
			http.Error(w, "outgoing event queue is full", http.StatusServiceUnavailable)
		}
	}
}

type setFreqRequest struct {
	Dial   uint32 `json:"dial"`
	Offset uint16 `json:"offset"`
}

// POST /api/rig/freq — sends RIG.SET_FREQ to JS8Call
func apiRigFreqPost(outgoingEvents chan<- model.Js8callEvent) func(http.ResponseWriter, *http.Request, *sql.DB) {
	return func(w http.ResponseWriter, req *http.Request, db *sql.DB) {
		var body setFreqRequest
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil || body.Dial == 0 {
			http.Error(w, "dial frequency required", http.StatusBadRequest)
			return
		}
		event := model.Js8callEvent{
			Type: model.EVENT_TYPE_RIG_SET_FREQ,
			Params: model.Js8callEventParams{
				Dial:   body.Dial,
				Freq:   body.Dial + uint32(body.Offset),
				Offset: body.Offset,
			},
		}
		select {
		case outgoingEvents <- event:
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]bool{"ok": true})
		default:
			http.Error(w, "outgoing event queue is full", http.StatusServiceUnavailable)
		}
	}
}

type setSpeedRequest struct {
	Speed int `json:"speed"`
}

// POST /api/rig/speed — sends MODE.SET_SPEED to JS8Call
func apiRigSpeedPost(outgoingEvents chan<- model.Js8callEvent) func(http.ResponseWriter, *http.Request, *sql.DB) {
	return func(w http.ResponseWriter, req *http.Request, db *sql.DB) {
		var body setSpeedRequest
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}
		event := model.Js8callEvent{
			Type: model.EVENT_TYPE_MODE_SET_SPEED,
			Params: model.Js8callEventParams{
				Speed: body.Speed,
			},
		}
		select {
		case outgoingEvents <- event:
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]bool{"ok": true})
		default:
			http.Error(w, "outgoing event queue is full", http.StatusServiceUnavailable)
		}
	}
}

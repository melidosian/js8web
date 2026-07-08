package main

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/PiotrTopa/js8web/model"
)

type setStationValueRequest struct {
	Value string `json:"value"`
}

func apiStationSetPost(eventType string, outgoingEvents chan<- model.Js8callEvent) func(http.ResponseWriter, *http.Request, *sql.DB) {
	return func(w http.ResponseWriter, req *http.Request, db *sql.DB) {
		var body setStationValueRequest
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}

		event := model.Js8callEvent{
			Type:  eventType,
			Value: body.Value,
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

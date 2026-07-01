package main

import "github.com/PiotrTopa/js8web/model"

// inboxMessagesNotifier handles the bulk INBOX.MESSAGES response (sent on connect).
func inboxMessagesNotifier(event *model.Js8callEvent, websocketEvents chan<- model.WebsocketEvent, databaseObjects chan<- model.DbObj) error {
	for _, msg := range event.Params.Messages {
		obj := model.CreateInboxMessageObj(msg.Callsign, msg.Text, msg.Utc)
		databaseObjects <- obj
	}
	return nil
}

// inboxMessageNotifier handles a single incoming INBOX.MESSAGE event.
func inboxMessageNotifier(event *model.Js8callEvent, websocketEvents chan<- model.WebsocketEvent, databaseObjects chan<- model.DbObj) error {
	callsign := event.Params.From
	if callsign == "" {
		callsign = event.Params.Callsign
	}
	text := event.Value
	if text == "" {
		text = event.Params.Text
	}
	obj := model.CreateInboxMessageObj(callsign, text, event.Params.UTC)
	databaseObjects <- obj
	return nil
}

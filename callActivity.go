package main

import (
	"github.com/PiotrTopa/js8web/model"
)

var callActivityCache = model.CallActivityWsEvent{}

func callActivityNotifier(event *model.Js8callEvent, websocketEvents chan<- model.WebsocketEvent, databaseObjects chan<- model.DbObj) error {
	wsEvent, err := model.CreateCallActivityWsEvent(event)
	if err != nil {
		return err
	}
	callActivityCache = wsEvent
	websocketEvents <- callActivityCache
	return nil
}

package main

import (
	"github.com/PiotrTopa/js8web/model"
)

var bandActivityCache = model.BandActivityWsEvent{}

func bandActivityNotifier(event *model.Js8callEvent, websocketEvents chan<- model.WebsocketEvent, databaseObjects chan<- model.DbObj) error {
	wsEvent, err := model.CreateBandActivityWsEvent(event)
	if err != nil {
		return err
	}
	bandActivityCache = wsEvent
	websocketEvents <- bandActivityCache
	return nil
}

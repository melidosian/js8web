package model

import "errors"

// CallActivityWsEvent is the full current snapshot of JS8Call's call activity window,
// keyed by callsign. Broadcast whole rather than diffed, since JS8Call itself resends
// the entire window contents on each update.
type CallActivityWsEvent map[string]CallActivityEntry

func (o CallActivityWsEvent) WsType() string { return WS_EVENT_TYPE_CALL_ACTIVITY }

func CreateCallActivityWsEvent(event *Js8callEvent) (CallActivityWsEvent, error) {
	if event.Type != EVENT_TYPE_RX_CALL_ACTIVITY {
		return nil, errors.New("wrong event type, cannot parse params")
	}
	return CallActivityWsEvent(event.CallActivity), nil
}

package model

import "errors"

// BandActivityWsEvent is the full current snapshot of JS8Call's band activity window,
// keyed by offset. Broadcast whole rather than diffed, since JS8Call itself resends
// the entire window contents on each update.
type BandActivityWsEvent map[string]BandActivityEntry

func (o BandActivityWsEvent) WsType() string { return WS_EVENT_TYPE_BAND_ACTIVITY }

func CreateBandActivityWsEvent(event *Js8callEvent) (BandActivityWsEvent, error) {
	if event.Type != EVENT_TYPE_RX_BAND_ACTIVITY {
		return nil, errors.New("wrong event type, cannot parse params")
	}
	return BandActivityWsEvent(event.BandActivity), nil
}

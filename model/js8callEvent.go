package model

import "encoding/json"

var (
	MODE_JS8                    = "js8"
	EVENT_TYPE_RX_ACTIVITY      = "RX.ACTIVITY"
	EVENT_TYPE_RX_DIRECTED      = "RX.DIRECTED"
	EVENT_TYPE_RX_DIRECTED_ME   = "RX.DIRECTED.ME"
	EVENT_TYPE_RX_SPOT          = "RX.SPOT"
	EVENT_TYPE_RIG_PTT          = "RIG.PTT"
	EVENT_TYPE_TX_FRAME         = "TX.FRAME"
	EVENT_TYPE_RIG_STATUS       = "RIG.STATUS"
	EVENT_TYPE_STATION_STATUS   = "STATION.STATUS"
	EVENT_TYPE_STATION_INFO     = "STATION.INFO"
	EVENT_TYPE_STATION_CALLSIGN = "STATION.CALLSIGN"
	EVENT_TYPE_STATION_GRID     = "STATION.GRID"

	// station get/set events
	EVENT_TYPE_STATION_GET_CALLSIGN = "STATION.GET_CALLSIGN"
	EVENT_TYPE_STATION_GET_GRID     = "STATION.GET_GRID"
	EVENT_TYPE_STATION_SET_GRID     = "STATION.SET_GRID"
	EVENT_TYPE_STATION_GET_INFO     = "STATION.GET_INFO"
	EVENT_TYPE_STATION_SET_INFO     = "STATION.SET_INFO"
	EVENT_TYPE_STATION_GET_STATUS   = "STATION.GET_STATUS"
	EVENT_TYPE_STATION_SET_STATUS   = "STATION.SET_STATUS"

	// inbox events
	EVENT_TYPE_INBOX_MESSAGE       = "INBOX.MESSAGE"
	EVENT_TYPE_INBOX_MESSAGES      = "INBOX.MESSAGES"
	EVENT_TYPE_INBOX_GET_MESSAGES  = "INBOX.GET_MESSAGES"
	EVENT_TYPE_INBOX_STORE_MESSAGE = "INBOX.STORE_MESSAGE"

	// rig/mode events
	EVENT_TYPE_RIG_FREQ       = "RIG.FREQ"
	EVENT_TYPE_RIG_GET_FREQ   = "RIG.GET_FREQ"
	EVENT_TYPE_RIG_SET_FREQ   = "RIG.SET_FREQ"
	EVENT_TYPE_MODE_SPEED     = "MODE.SPEED"
	EVENT_TYPE_MODE_GET_SPEED = "MODE.GET_SPEED"
	EVENT_TYPE_MODE_SET_SPEED = "MODE.SET_SPEED"

	// activity window events
	EVENT_TYPE_RX_GET_CALL_ACTIVITY = "RX.GET_CALL_ACTIVITY"
	EVENT_TYPE_RX_CALL_ACTIVITY     = "RX.CALL_ACTIVITY"
	EVENT_TYPE_RX_GET_BAND_ACTIVITY = "RX.GET_BAND_ACTIVITY"
	EVENT_TYPE_RX_BAND_ACTIVITY     = "RX.BAND_ACTIVITY"

	// outgoing event types (sent to JS8Call)
	EVENT_TYPE_TX_SEND_MESSAGE = "TX.SEND_MESSAGE"

	// event types as seen in Websocket communication
	WS_EVENT_TYPE_RIG_PTT       = "RIG.PTT"
	WS_EVENT_TYPE_RIG_STATUS    = "RIG.STATUS"
	WS_EVENT_TYPE_STATION_INFO  = "STATION.INFO"
	WS_EVENT_TYPE_CALL_ACTIVITY = "RX.CALL_ACTIVITY"
	WS_EVENT_TYPE_BAND_ACTIVITY = "RX.BAND_ACTIVITY"
	WS_OBJ_TYPE_RX_PACKET       = "RX.PACKET"
	WS_OBJ_TYPE_RX_SPOT         = "RX.SPOT"
	WS_OBJ_TYPE_TX_FRAME        = "TX.FRAME"
	WS_OBJ_TYPE_INBOX_MESSAGE   = "INBOX.MESSAGE"
	WS_OBJ_TYPE_OTHER           = "OTHER"
)

type Js8callEvent struct {
	Type   string             `json:"type"`
	Value  string             `json:"value"`
	Params Js8callEventParams `json:"params"`

	// CallActivity/BandActivity hold the params payload for RX.CALL_ACTIVITY/RX.BAND_ACTIVITY
	// events, whose "params" is a dict keyed by callsign/offset rather than the fixed shape
	// every other event uses. See UnmarshalJSON.
	CallActivity map[string]CallActivityEntry `json:"-"`
	BandActivity map[string]BandActivityEntry `json:"-"`

	DataType string
	Data     interface{}
}

// UnmarshalJSON decodes params into the fixed Js8callEventParams shape for most event
// types, but into CallActivity/BandActivity for the two whose params is instead a dict
// keyed by callsign/offset.
func (e *Js8callEvent) UnmarshalJSON(data []byte) error {
	var raw struct {
		Type   string          `json:"type"`
		Value  string          `json:"value"`
		Params json.RawMessage `json:"params"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	e.Type = raw.Type
	e.Value = raw.Value

	if len(raw.Params) == 0 {
		return nil
	}
	switch e.Type {
	case EVENT_TYPE_RX_CALL_ACTIVITY:
		return json.Unmarshal(raw.Params, &e.CallActivity)
	case EVENT_TYPE_RX_BAND_ACTIVITY:
		return json.Unmarshal(raw.Params, &e.BandActivity)
	default:
		return json.Unmarshal(raw.Params, &e.Params)
	}
}

// CallActivityEntry is one callsign's entry in RX.CALL_ACTIVITY's params dict.
type CallActivityEntry struct {
	Grid string `json:"GRID"`
	Snr  int    `json:"SNR"`
	UTC  int64  `json:"UTC"`
}

// BandActivityEntry is one offset's entry in RX.BAND_ACTIVITY's params dict.
type BandActivityEntry struct {
	Dial   uint32 `json:"DIAL"`
	Freq   uint32 `json:"FREQ"`
	Offset uint16 `json:"OFFSET"`
	Snr    int    `json:"SNR"`
	Text   string `json:"TEXT"`
	UTC    int64  `json:"UTC"`
}

// InboxMessageParam is an element in the MESSAGES array from INBOX.MESSAGES events.
type InboxMessageParam struct {
	Callsign string `json:"CALLSIGN"`
	Text     string `json:"TEXT"`
	Utc      int64  `json:"UTC"`
}

type Js8callEventParams struct {
	Id        interface{}         `json:"_ID"`
	Dial      uint32              `json:"DIAL"`
	Freq      uint32              `json:"FREQ"`
	Offset    uint16              `json:"OFFSET"`
	Snr       int16               `json:"SNR"`
	Speed     int                 `json:"SPEED"`
	TimeDrift float32             `json:"TDRIFT"`
	Grid      string              `json:"GRID"`
	From      string              `json:"FROM"`
	Call      string              `json:"CALL"`
	To        string              `json:"TO"`
	Text      string              `json:"TEXT"`
	Command   string              `json:"CMD"`
	Extra     string              `json:"EXTRA"`
	PTT       bool                `json:"PTT"`
	Tones     []int               `json:"TONES"`
	UTC       int64               `json:"UTC"`
	Selected  string              `json:"SELECTED"`
	Band      string              `json:"BAND"`
	Mode      string              `json:"MODE"`
	Submode   string              `json:"SUBMODE"`
	RptSent   string              `json:"RPT.SENT"`
	RptRecv   string              `json:"RPT.RECV"`
	Callsign  string              `json:"CALLSIGN"`
	Messages  []InboxMessageParam `json:"MESSAGES"`
}

func CalcChannelFromOffset(offset uint16) uint16 {
	return uint16((offset - 25) / 50)
}

func SpeedName(speed int) string {
	switch speed {
	case 0:
		return "normal"
	case 1:
		return "fast"
	case 2:
		return "turbo"
	case 4:
		return "slow"
	case 8:
		return "ultra"
	default:
		return "unknown"
	}
}

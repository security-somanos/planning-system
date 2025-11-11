package models

type Location struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Address        string `json:"address,omitempty"`
	GoogleMapsLink string `json:"googleMapsLink,omitempty"`
	Type           string `json:"type,omitempty"`
}

type Vehicle struct {
	ID                   string  `json:"id"`
	Label                string  `json:"label"`
	Make                 string  `json:"make,omitempty"`
	Model                string  `json:"model,omitempty"`
	LicensePlate         string  `json:"licensePlate,omitempty"`
	Capacity             *int    `json:"capacity,omitempty"`
	Notes                string  `json:"notes,omitempty"`
	AvailableFrom        *string `json:"availableFrom,omitempty"`
	AvailableTo          *string `json:"availableTo,omitempty"`
	OriginationLocationID *string `json:"originationLocationId,omitempty"`
}

type Participant struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	Roles           []string `json:"roles"`
	Email           string   `json:"email,omitempty"`
	Phone           string   `json:"phone,omitempty"`
	Languages       []string `json:"languages,omitempty"`
	AssignedBlockIDs []string `json:"assignedBlockIds,omitempty"` // derived
}

type Event struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	StartDate   string `json:"startDate"` // ISO date (YYYY-MM-DD)
	EndDate     string `json:"endDate"`   // ISO date (YYYY-MM-DD)
}

type Day struct {
	ID        string     `json:"id"`
	EventID   string     `json:"eventId"`
	Date      string     `json:"date"` // ISO date (YYYY-MM-DD)
	Blocks    []Block    `json:"blocks"` // ordered
	Movements []Movement `json:"movements"` // ordered
}

type ItineraryDay struct {
	Day       Day        `json:"day"`
	Blocks    []Block    `json:"blocks"`
	Movements []Movement `json:"movements"`
}

type AgendaItem struct {
	DayID string `json:"day_id"`
	Date  string `json:"date"`
	Block Block  `json:"block"`
}

type ScheduleItem struct {
	ID                string  `json:"id"`
	BlockID           string  `json:"-"` // internal only
	Time              string  `json:"time"` // HH:mm
	Description       string  `json:"description"`
	StaffInstructions string  `json:"staffInstructions,omitempty"`
	GuestInstructions string  `json:"guestInstructions,omitempty"`
	Notes             *string `json:"notes,omitempty"`
}

type Block struct {
	ID                    string         `json:"id"`
	DayID                 string         `json:"-"` // internal only
	Type                  string         `json:"type"` // "activity" | "break"
	Title                 string         `json:"title"`
	Description           string         `json:"description,omitempty"`
	StartTime             string         `json:"startTime"` // HH:mm
	EndTime               string         `json:"endTime,omitempty"` // HH:mm
	EndTimeFixed          *bool          `json:"endTimeFixed,omitempty"`
	LocationID            *string        `json:"locationId,omitempty"`
	ParticipantsIds       []string        `json:"participantsIds,omitempty"`
	AdvanceParticipantIDs []string        `json:"advanceParticipantIds,omitempty"`
	MetByParticipantIDs   []string        `json:"metByParticipantIds,omitempty"`
	Attachments           []string        `json:"attachments,omitempty"`
	Notes                 string          `json:"notes,omitempty"`
	ScheduleItems         []ScheduleItem  `json:"scheduleItems,omitempty"` // ordered by time
}

type Movement struct {
	ID                 string             `json:"id"`
	DayID              string             `json:"-"` // internal only
	Title              string             `json:"title"`
	Description        string             `json:"description,omitempty"`
	FromLocationID     string             `json:"fromLocationId"`
	ToLocationID       string             `json:"toLocationId"`
	FromTime           string             `json:"fromTime"` // HH:mm
	ToTimeType         string             `json:"toTimeType"` // "fixed" | "driving"
	ToTime             string             `json:"toTime"` // HH:mm if fixed, or total minutes as string if driving
	DrivingTimeHours   *int               `json:"drivingTimeHours,omitempty"`
	DrivingTimeMinutes *int               `json:"drivingTimeMinutes,omitempty"`
	VehicleAssignments []VehicleAssignment `json:"vehicleAssignments,omitempty"`
	Notes              string             `json:"notes,omitempty"`
}

type VehicleAssignment struct {
	ID            string   `json:"-"` // internal only
	MovementID    string   `json:"-"` // internal only
	VehicleID     string   `json:"vehicleId"`
	DriverID      *string  `json:"driverId,omitempty"`
	ParticipantIDs []string `json:"participantIds,omitempty"`
}

type CreateDaysRequest struct {
	Dates []string `json:"dates"` // Array of ISO dates (YYYY-MM-DD)
}



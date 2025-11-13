package models

type Location struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Address        string   `json:"address,omitempty"`
	GoogleMapsLink string   `json:"googleMapsLink,omitempty"`
	Type           string   `json:"type,omitempty"`
	Contact        []string `json:"contact,omitempty"`        // Array of contact information (phone, email, etc.)
	SiteManagerIDs []string `json:"siteManagerIds,omitempty"` // Array of participant IDs who manage this location
}

type Vehicle struct {
	ID                    string  `json:"id"`
	Label                 string  `json:"label"`
	Make                  string  `json:"make,omitempty"`
	Model                 string  `json:"model,omitempty"`
	LicensePlate          string  `json:"licensePlate,omitempty"`
	Capacity              *int    `json:"capacity,omitempty"`
	Notes                 string  `json:"notes,omitempty"`
	AvailableFrom         *string `json:"availableFrom,omitempty"`
	AvailableTo           *string `json:"availableTo,omitempty"`
	OriginationLocationID *string `json:"originationLocationId,omitempty"`
}

type Participant struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	Roles            []string `json:"roles"`
	Email            string   `json:"email,omitempty"`
	Phone            string   `json:"phone,omitempty"`
	Languages        []string `json:"languages,omitempty"`
	UserID           *string  `json:"userId,omitempty"`
	AssignedBlockIDs []string `json:"assignedBlockIds,omitempty"` // derived
	IsPasswordSet    bool     `json:"isPasswordSet"`              // derived from user.password_hash
	IsUserEnabled    *bool    `json:"isUserEnabled,omitempty"`    // from user.is_user_enabled
}

type User struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	PasswordHash  string `json:"-"`    // Never serialize password hash
	Role          string `json:"role"` // "admin" | "user"
	IsUserEnabled bool   `json:"isUserEnabled"`
	CreatedAt     string `json:"createdAt,omitempty"`
	UpdatedAt     string `json:"updatedAt,omitempty"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type CreateParticipantRequest struct {
	Name          string   `json:"name"`
	Roles         []string `json:"roles"`
	Email         string   `json:"email,omitempty"`
	Phone         string   `json:"phone,omitempty"`
	Languages     []string `json:"languages,omitempty"`
	Password      string   `json:"password,omitempty"`      // Optional: if provided, creates user account
	IsUserEnabled *bool    `json:"isUserEnabled,omitempty"` // Optional: enables login for the user
}

type UpdateParticipantRequest struct {
	Name          string   `json:"name,omitempty"`
	Roles         []string `json:"roles,omitempty"`
	Email         string   `json:"email,omitempty"`
	Phone         string   `json:"phone,omitempty"`
	Languages     []string `json:"languages,omitempty"`
	Password      string   `json:"password,omitempty"`      // Optional: if provided, updates/creates password
	IsUserEnabled *bool    `json:"isUserEnabled,omitempty"` // Optional: enables/disables login
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
	Date      string     `json:"date"`      // ISO date (YYYY-MM-DD)
	Blocks    []Block    `json:"blocks"`    // ordered
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
	BlockID           string  `json:"-"`    // internal only
	Time              string  `json:"time"` // HH:mm
	Description       string  `json:"description"`
	StaffInstructions string  `json:"staffInstructions,omitempty"`
	GuestInstructions string  `json:"guestInstructions,omitempty"`
	Notes             *string `json:"notes,omitempty"`
}

type Block struct {
	ID                    string         `json:"id"`
	DayID                 string         `json:"-"`    // internal only
	Type                  string         `json:"type"` // "activity" | "break"
	Title                 string         `json:"title"`
	Description           string         `json:"description,omitempty"`
	StartTime             string         `json:"startTime"`         // HH:mm
	EndTime               string         `json:"endTime,omitempty"` // HH:mm
	EndTimeFixed          *bool          `json:"endTimeFixed,omitempty"`
	LocationID            *string        `json:"locationId,omitempty"`
	ParticipantsIds       []string       `json:"participantsIds,omitempty"`
	AdvanceParticipantIDs []string       `json:"advanceParticipantIds,omitempty"`
	MetByParticipantIDs   []string       `json:"metByParticipantIds,omitempty"`
	Attachments           []string       `json:"attachments,omitempty"`
	Notes                 string         `json:"notes,omitempty"`
	ScheduleItems         []ScheduleItem `json:"scheduleItems,omitempty"` // ordered by time
}

type Movement struct {
	ID                 string              `json:"id"`
	DayID              string              `json:"-"` // internal only
	Title              string              `json:"title"`
	Description        string              `json:"description,omitempty"`
	FromLocationID     string              `json:"fromLocationId"`
	ToLocationID       string              `json:"toLocationId"`
	FromTime           string              `json:"fromTime"`   // HH:mm
	ToTimeType         string              `json:"toTimeType"` // "fixed" | "driving"
	ToTime             string              `json:"toTime"`     // HH:mm if fixed, or total minutes as string if driving
	DrivingTimeHours   *int                `json:"drivingTimeHours,omitempty"`
	DrivingTimeMinutes *int                `json:"drivingTimeMinutes,omitempty"`
	VehicleAssignments []VehicleAssignment `json:"vehicleAssignments,omitempty"`
	Notes              string              `json:"notes,omitempty"`
}

type VehicleAssignment struct {
	ID             string   `json:"-"` // internal only
	MovementID     string   `json:"-"` // internal only
	VehicleID      string   `json:"vehicleId"`
	DriverID       *string  `json:"driverId,omitempty"`
	ParticipantIDs []string `json:"participantIds,omitempty"`
}

type CreateDaysRequest struct {
	Dates []string `json:"dates"` // Array of ISO dates (YYYY-MM-DD)
}

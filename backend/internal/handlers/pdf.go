package handlers

import (
	"bytes"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"planning-system/backend/internal/auth"
	"planning-system/backend/internal/models"
	"planning-system/backend/internal/repos"

	"github.com/jung-kurt/gofpdf"
)

// ExportPDF generates a PDF export of the event with days, blocks, movements, participants, locations, and vehicles.
func (h *Handlers) ExportPDF(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUserFromContext(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Fetch data
	days, err := h.sv.Days.List(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to load days"}`, http.StatusInternalServerError)
		return
	}

	// Filter by involvement if not admin
	if user.Role != "admin" {
		filtered := make([]models.Day, 0)
		for _, day := range days {
			involved, err := h.sv.Involvement.IsUserInvolvedInDay(r.Context(), user.ID, day.ID)
			if err != nil {
				h.log.Error().Err(err).Msg("failed to check involvement")
				continue
			}
			if involved {
				filtered = append(filtered, day)
			}
		}
		days = filtered
	}
	// Participants (fetch many)
	participants, _, err := h.sv.Participants.List(r.Context(), repos.PageParams{Limit: 10000, Offset: 0}, "", "")
	if err != nil {
		http.Error(w, `{"error":"failed to load participants"}`, http.StatusInternalServerError)
		return
	}
	locations, err := h.sv.Locations.List(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to load locations"}`, http.StatusInternalServerError)
		return
	}
	vehicles, err := h.sv.Vehicles.List(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to load vehicles"}`, http.StatusInternalServerError)
		return
	}

	// Build lookups
	locByID := map[string]models.Location{}
	for _, l := range locations {
		locByID[l.ID] = l
	}
	// Participants lookup
	partByID := map[string]models.Participant{}
	for _, p := range participants {
		partByID[p.ID] = p
	}
	vehByID := map[string]models.Vehicle{}
	for _, v := range vehicles {
		vehByID[v.ID] = v
	}

	pdf := gofpdf.New("L", "mm", "A4", "") // Landscape orientation

	// Register Times New Roman fonts
	pdf.AddUTF8Font("Times", "", filepath.Join("assets", "fonts", "times.ttf"))
	pdf.AddUTF8Font("Times", "B", filepath.Join("assets", "fonts", "timesbd.ttf"))
	pdf.AddUTF8Font("Times", "I", filepath.Join("assets", "fonts", "timesi.ttf"))
	pdf.AddUTF8Font("Times", "BI", filepath.Join("assets", "fonts", "timesbi.ttf"))

	// Header configuration - shared between header callback and date positioning
	headerStartY := 6.0
	logoHeight := 18.0
	headerBottomY := headerStartY + logoHeight + 4.0
	headerContentPadding := 8.0                               // Additional padding after header for content
	headerTotalHeight := headerBottomY + headerContentPadding // Total header height including spacing and padding

	// Set top margin to account for header height
	pdf.SetMargins(12, headerTotalHeight, 12)
	pdf.SetAutoPageBreak(true, 12)

	// Header callbacks support
	logoPath := filepath.Join("assets", "logo.png")
	pdf.RegisterImageOptions(logoPath, gofpdf.ImageOptions{ImageType: "PNG", ReadDpi: true})

	// Track current day's date for header callback
	var currentDayDate string
	var isCoverPage bool = true // Track if we're on the cover page

	headerCallbacks := []func(*gofpdf.Fpdf){
		func(p *gofpdf.Fpdf) {
			// Skip header on cover page
			if isCoverPage {
				return
			}

			// Default header: logo on the right and a subtle bottom border
			pageW := 297.0
			rightMargin := 12.0
			y := headerStartY
			logoH := logoHeight

			// Calculate logo width to position it on the right
			logoWidth := 0.0
			if info := p.GetImageInfo(logoPath); info != nil {
				// Calculate width based on aspect ratio
				imgWidth := info.Width()
				imgHeight := info.Height()
				if imgHeight > 0 {
					aspectRatio := imgWidth / imgHeight
					logoWidth = logoH * aspectRatio
				}
			}

			// Position logo on the right
			x := pageW - rightMargin - logoWidth

			if info := p.GetImageInfo(logoPath); info != nil {
				p.ImageOptions(logoPath, x, y, 0, logoH, false, gofpdf.ImageOptions{ImageType: "PNG", ReadDpi: true}, 0, "")
			} else {
				p.ImageOptions(logoPath, x, y, 0, logoH, false, gofpdf.ImageOptions{ImageType: "PNG", ReadDpi: true}, 0, "")
			}

			// Draw date if available (same position on every page - still on the left)
			if currentDayDate != "" {
				dateStr := formatDateHeader(currentDayDate)
				dateY := headerStartY + logoHeight - 4.0
				p.SetY(dateY)
				p.SetFont("Times", "B", 14)
				p.CellFormat(0, 10, dateStr, "", 0, "L", false, 0, "")
			}

			// Subtle bottom border (approx 1px)
			bottomY := headerBottomY
			leftMargin := 12.0
			p.SetDrawColor(200, 200, 200)
			p.SetLineWidth(0.35)
			p.Line(leftMargin, bottomY, pageW-rightMargin, bottomY)
			// Move Y so content starts below header with additional padding
			p.SetY(bottomY + headerContentPadding)
		},
	}
	// Install wrapper header to call all callbacks
	pdf.SetHeaderFuncMode(func() {
		for _, cb := range headerCallbacks {
			cb(pdf)
		}
	}, true)

	// First page with banner and title only (landscape)
	// Cover page - no header should appear
	isCoverPage = true
	pdf.AddPage()

	// Add banner image - make it tall with auto-scaling width, centered horizontally
	bannerPath := filepath.Join("assets", "banner.png")
	options := gofpdf.ImageOptions{ImageType: "PNG", ReadDpi: true}
	pdf.RegisterImageOptions(bannerPath, options)

	// Landscape page dimensions: 297mm x 210mm
	pageWidth := 297.0 - 24.0  // Landscape width minus margins (12mm left and right)
	pageHeight := 210.0 - 24.0 // Landscape height minus margins (12mm top and bottom)
	bannerHeight := pageHeight * 0.5

	// Get image info to calculate aspect ratio and scaled width
	imgInfo := pdf.GetImageInfo(bannerPath)
	var bannerX float64 = 0 // Default to left margin

	if imgInfo != nil {
		// Calculate scaled width based on height and aspect ratio
		imgWidth := imgInfo.Width()
		imgHeight := imgInfo.Height()
		aspectRatio := imgWidth / imgHeight
		bannerWidth := bannerHeight * aspectRatio

		// Center horizontally: (pageWidth - bannerWidth) / 2 + margin
		bannerX = 12 + (pageWidth-bannerWidth)/2
	}

	// Cover page uses regular margins (no header)
	pdf.ImageOptions(bannerPath, bannerX, 12, 0, bannerHeight, false, options, 0, "")

	// Position title below banner, centered
	pdf.SetY(12 + bannerHeight + 20)
	pdf.SetFont("Times", "B", 18)
	pdf.CellFormat(0, 10, "GLOBAL LINE BY LINE", "", 0, "C", false, 0, "")

	// Section: Days - all pages are landscape
	for _, d := range days {
		// Skip days with no blocks and no movements
		if len(d.Blocks) == 0 && len(d.Movements) == 0 {
			continue
		}

		// Set current day's date for header callback
		currentDayDate = d.Date
		// Mark that we're no longer on the cover page
		isCoverPage = false

		// Add new page for each day
		pdf.AddPage()

		// Content will start below header automatically due to margin setting
		// No need to manually set Y position or draw date here - header callback handles it

		// Helper function to check available space and add page if needed
		checkAndAddPageIfNeeded := func(requiredHeight float64) {
			pageHeight := 210.0 // Landscape page height
			topMargin := headerTotalHeight
			bottomMargin := 12.0
			availableHeight := pageHeight - topMargin - bottomMargin
			minRequiredSpace := availableHeight * 0.4 // 40% of available space

			currentY := pdf.GetY()
			remainingSpace := pageHeight - bottomMargin - currentY

			if remainingSpace < minRequiredSpace || remainingSpace < requiredHeight {
				pdf.AddPage()
			}
		}

		// Blocks (Activities) - each block gets its own event description tables and line by line
		if len(d.Blocks) > 0 {
			for _, b := range d.Blocks {
				// Estimate height needed for event description table (conservative estimate)
				estimatedDescHeight := 80.0 // Approximate height for description table
				checkAndAddPageIfNeeded(estimatedDescHeight)

				// Draw description table
				drawEventDescriptionTables(pdf, b, locByID, partByID)

				// Recheck space for notes table if it exists (after drawing description table)
				// The notes table is drawn side-by-side, but we check if we have space for it
				if b.Notes != "" {
					estimatedNotesHeight := 60.0 // Approximate height for notes table
					// Check if we still have 40% space available
					pageHeight := 210.0
					topMargin := headerTotalHeight
					bottomMargin := 12.0
					availableHeight := pageHeight - topMargin - bottomMargin
					minRequiredSpace := availableHeight * 0.4
					currentY := pdf.GetY()
					remainingSpace := pageHeight - bottomMargin - currentY

					// If not enough space, add a new page (notes will be drawn on new page)
					if remainingSpace < minRequiredSpace || remainingSpace < estimatedNotesHeight {
						pdf.AddPage()
					}
				}

				pdf.Ln(5)

				// Line by line section
				if len(b.ScheduleItems) > 0 {
					// Estimate height for line-by-line table (rough estimate: 10mm per row)
					estimatedLineByLineHeight := float64(len(b.ScheduleItems)+1) * 10.0 // +1 for header
					checkAndAddPageIfNeeded(estimatedLineByLineHeight)
					drawLineByLineTable(pdf, b)
					pdf.Ln(5)
				}
			}
		}

		// Movements
		if len(d.Movements) > 0 {
			for _, m := range d.Movements {
				// Estimate height needed for movement description table (conservative estimate)
				estimatedMovementHeight := 80.0 // Approximate height for description table
				checkAndAddPageIfNeeded(estimatedMovementHeight)

				// Draw movement description table
				drawMovementDescriptionTables(pdf, m, locByID)

				// Recheck space for notes table if it exists
				if m.Notes != "" {
					estimatedNotesHeight := 60.0
					pageHeight := 210.0
					topMargin := headerTotalHeight
					bottomMargin := 12.0
					availableHeight := pageHeight - topMargin - bottomMargin
					minRequiredSpace := availableHeight * 0.4
					currentY := pdf.GetY()
					remainingSpace := pageHeight - bottomMargin - currentY

					if remainingSpace < minRequiredSpace || remainingSpace < estimatedNotesHeight {
						pdf.AddPage()
					}
				}

				pdf.Ln(5)

				// Vehicle assignments table
				if len(m.VehicleAssignments) > 0 {
					// Estimate height for vehicle assignments table
					estimatedVehicleHeight := float64(len(m.VehicleAssignments)+1) * 15.0 // +1 for header
					checkAndAddPageIfNeeded(estimatedVehicleHeight)
					drawVehicleAssignmentsTable(pdf, m, vehByID, partByID)
					pdf.Ln(5)
				}
			}
		}

		// End of day - add "END DAY [DAYNAME] [DAY]th" text
		pdf.Ln(10) // Add some spacing before END DAY
		pdf.SetFont("Times", "B", 14)

		// Format date for END DAY: "END DAY THURSDAY 20th"
		endDayText := formatEndDayText(d.Date)
		pdf.CellFormat(0, 10, endDayText, "", 0, "C", false, 0, "") // Centered
		pdf.Ln(10)

		// Always add a new page after END DAY
		pdf.AddPage()
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		http.Error(w, `{"error":"failed to generate pdf"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `inline; filename="itinerary.pdf"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(buf.Bytes())
}

// ExportMyItineraryPDF generates a PDF export for regular users with their name on the cover
// and only shows data where they're involved, with filtered vehicle assignments
func (h *Handlers) ExportMyItineraryPDF(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUserFromContext(r)
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Get user's participant to get their name
	participantID, err := h.sv.Involvement.GetParticipantIDByUserID(r.Context(), user.ID)
	var userName string = "My Itinerary"
	if err == nil && participantID != "" {
		participant, err := h.sv.Participants.Get(r.Context(), participantID)
		if err == nil {
			userName = participant.Name
		}
	}

	// Fetch data - already filtered by involvement in ListDays
	days, err := h.sv.Days.List(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to load days"}`, http.StatusInternalServerError)
		return
	}

	// Filter by involvement (always filter for this endpoint)
	filtered := make([]models.Day, 0)
	for _, day := range days {
		involved, err := h.sv.Involvement.IsUserInvolvedInDay(r.Context(), user.ID, day.ID)
		if err != nil {
			h.log.Error().Err(err).Msg("failed to check involvement")
			continue
		}
		if involved {
			filtered = append(filtered, day)
		}
	}
	days = filtered

	// Filter vehicle assignments for each movement in each day
	for i := range days {
		for j := range days[i].Movements {
			filteredAssignments := make([]models.VehicleAssignment, 0)
			for _, assignment := range days[i].Movements[j].VehicleAssignments {
				// Include if user's participant is the driver
				if assignment.DriverID != nil && *assignment.DriverID == participantID {
					filteredAssignments = append(filteredAssignments, assignment)
					continue
				}
				// Include if user's participant is in the passenger list
				for _, pid := range assignment.ParticipantIDs {
					if pid == participantID {
						filteredAssignments = append(filteredAssignments, assignment)
						break
					}
				}
			}
			days[i].Movements[j].VehicleAssignments = filteredAssignments
		}
	}

	// Get participants (all - needed for lookups in blocks/movements)
	participants, _, err := h.sv.Participants.List(r.Context(), repos.PageParams{Limit: 10000, Offset: 0}, "", "")
	if err != nil {
		http.Error(w, `{"error":"failed to load participants"}`, http.StatusInternalServerError)
		return
	}

	// Get locations and vehicles - filter by involvement for regular users
	allLocations, err := h.sv.Locations.List(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to load locations"}`, http.StatusInternalServerError)
		return
	}
	allVehicles, err := h.sv.Vehicles.List(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to load vehicles"}`, http.StatusInternalServerError)
		return
	}

	// Filter locations and vehicles by involvement
	var locations []models.Location
	var vehicles []models.Vehicle
	if user.Role == "admin" {
		locations = allLocations
		vehicles = allVehicles
	} else {
		// Filter locations
		locationIDs, err := h.sv.Involvement.GetLocationsForUser(r.Context(), user.ID)
		if err == nil {
			locationIDMap := make(map[string]bool)
			for _, lid := range locationIDs {
				locationIDMap[lid] = true
			}
			for _, loc := range allLocations {
				if locationIDMap[loc.ID] {
					locations = append(locations, loc)
				}
			}
		}

		// Filter vehicles
		vehicleIDs, err := h.sv.Involvement.GetVehiclesForUser(r.Context(), user.ID)
		if err == nil {
			vehicleIDMap := make(map[string]bool)
			for _, vid := range vehicleIDs {
				vehicleIDMap[vid] = true
			}
			for _, veh := range allVehicles {
				if vehicleIDMap[veh.ID] {
					vehicles = append(vehicles, veh)
				}
			}
		}
	}

	// Build lookups
	locByID := map[string]models.Location{}
	for _, l := range locations {
		locByID[l.ID] = l
	}
	partByID := map[string]models.Participant{}
	for _, p := range participants {
		partByID[p.ID] = p
	}
	vehByID := map[string]models.Vehicle{}
	for _, v := range vehicles {
		vehByID[v.ID] = v
	}

	pdf := gofpdf.New("L", "mm", "A4", "") // Landscape orientation

	// Register Times New Roman fonts
	pdf.AddUTF8Font("Times", "", filepath.Join("assets", "fonts", "times.ttf"))
	pdf.AddUTF8Font("Times", "B", filepath.Join("assets", "fonts", "timesbd.ttf"))
	pdf.AddUTF8Font("Times", "I", filepath.Join("assets", "fonts", "timesi.ttf"))
	pdf.AddUTF8Font("Times", "BI", filepath.Join("assets", "fonts", "timesbi.ttf"))

	// Header configuration - shared between header callback and date positioning
	headerStartY := 6.0
	logoHeight := 18.0
	headerBottomY := headerStartY + logoHeight + 4.0
	headerContentPadding := 8.0
	headerTotalHeight := headerBottomY + headerContentPadding

	// Set top margin to account for header height
	pdf.SetMargins(12, headerTotalHeight, 12)
	pdf.SetAutoPageBreak(true, 12)

	// Header callbacks support
	logoPath := filepath.Join("assets", "logo.png")
	pdf.RegisterImageOptions(logoPath, gofpdf.ImageOptions{ImageType: "PNG", ReadDpi: true})

	// Track current day's date for header callback
	var currentDayDate string
	var isCoverPage bool = true

	headerCallbacks := []func(*gofpdf.Fpdf){
		func(p *gofpdf.Fpdf) {
			// Skip header on cover page
			if isCoverPage {
				return
			}

			// Default header: logo on the right and a subtle bottom border
			pageW := 297.0
			rightMargin := 12.0
			y := headerStartY
			logoH := logoHeight

			// Calculate logo width to position it on the right
			logoWidth := 0.0
			if info := p.GetImageInfo(logoPath); info != nil {
				imgWidth := info.Width()
				imgHeight := info.Height()
				if imgHeight > 0 {
					aspectRatio := imgWidth / imgHeight
					logoWidth = logoH * aspectRatio
				}
			}

			// Position logo on the right
			x := pageW - rightMargin - logoWidth

			if info := p.GetImageInfo(logoPath); info != nil {
				p.ImageOptions(logoPath, x, y, 0, logoH, false, gofpdf.ImageOptions{ImageType: "PNG", ReadDpi: true}, 0, "")
			} else {
				p.ImageOptions(logoPath, x, y, 0, logoH, false, gofpdf.ImageOptions{ImageType: "PNG", ReadDpi: true}, 0, "")
			}

			// Draw date if available
			if currentDayDate != "" {
				dateStr := formatDateHeader(currentDayDate)
				dateY := headerStartY + logoHeight - 4.0
				p.SetY(dateY)
				p.SetFont("Times", "B", 14)
				p.CellFormat(0, 10, dateStr, "", 0, "L", false, 0, "")
			}

			// Subtle bottom border
			bottomY := headerBottomY
			leftMargin := 12.0
			p.SetDrawColor(200, 200, 200)
			p.SetLineWidth(0.35)
			p.Line(leftMargin, bottomY, pageW-rightMargin, bottomY)
			p.SetY(bottomY + headerContentPadding)
		},
	}
	pdf.SetHeaderFuncMode(func() {
		for _, cb := range headerCallbacks {
			cb(pdf)
		}
	}, true)

	// Cover page with user's name
	isCoverPage = true
	pdf.AddPage()

	// Add banner image
	bannerPath := filepath.Join("assets", "banner.png")
	options := gofpdf.ImageOptions{ImageType: "PNG", ReadDpi: true}
	pdf.RegisterImageOptions(bannerPath, options)

	pageWidth := 297.0 - 24.0
	pageHeight := 210.0 - 24.0
	bannerHeight := pageHeight * 0.5

	imgInfo := pdf.GetImageInfo(bannerPath)
	var bannerX float64 = 0

	if imgInfo != nil {
		imgWidth := imgInfo.Width()
		imgHeight := imgInfo.Height()
		aspectRatio := imgWidth / imgHeight
		bannerWidth := bannerHeight * aspectRatio
		bannerX = 12 + (pageWidth-bannerWidth)/2
	}

	pdf.ImageOptions(bannerPath, bannerX, 12, 0, bannerHeight, false, options, 0, "")

	// Position title below banner with user's name, centered
	pdf.SetY(12 + bannerHeight + 20)
	pdf.SetFont("Times", "B", 18)
	pdf.CellFormat(0, 10, strings.ToUpper(userName), "", 0, "C", false, 0, "")

	// Section: Days - all pages are landscape
	for _, d := range days {
		// Skip days with no blocks and no movements
		if len(d.Blocks) == 0 && len(d.Movements) == 0 {
			continue
		}

		currentDayDate = d.Date
		isCoverPage = false
		pdf.AddPage()

		checkAndAddPageIfNeeded := func(requiredHeight float64) {
			pageHeight := 210.0
			topMargin := headerTotalHeight
			bottomMargin := 12.0
			availableHeight := pageHeight - topMargin - bottomMargin
			minRequiredSpace := availableHeight * 0.4

			currentY := pdf.GetY()
			remainingSpace := pageHeight - bottomMargin - currentY

			if remainingSpace < minRequiredSpace || remainingSpace < requiredHeight {
				pdf.AddPage()
			}
		}

		// Blocks (Activities)
		if len(d.Blocks) > 0 {
			for _, b := range d.Blocks {
				estimatedDescHeight := 80.0
				checkAndAddPageIfNeeded(estimatedDescHeight)

				drawEventDescriptionTables(pdf, b, locByID, partByID)

				if b.Notes != "" {
					estimatedNotesHeight := 60.0
					pageHeight := 210.0
					topMargin := headerTotalHeight
					bottomMargin := 12.0
					availableHeight := pageHeight - topMargin - bottomMargin
					minRequiredSpace := availableHeight * 0.4
					currentY := pdf.GetY()
					remainingSpace := pageHeight - bottomMargin - currentY

					if remainingSpace < minRequiredSpace || remainingSpace < estimatedNotesHeight {
						pdf.AddPage()
					}
				}

				pdf.Ln(5)

				if len(b.ScheduleItems) > 0 {
					estimatedLineByLineHeight := float64(len(b.ScheduleItems)+1) * 10.0
					checkAndAddPageIfNeeded(estimatedLineByLineHeight)
					drawLineByLineTable(pdf, b)
					pdf.Ln(5)
				}
			}
		}

		// Movements
		if len(d.Movements) > 0 {
			for _, m := range d.Movements {
				estimatedMovementHeight := 80.0
				checkAndAddPageIfNeeded(estimatedMovementHeight)

				drawMovementDescriptionTables(pdf, m, locByID)

				if m.Notes != "" {
					estimatedNotesHeight := 60.0
					pageHeight := 210.0
					topMargin := headerTotalHeight
					bottomMargin := 12.0
					availableHeight := pageHeight - topMargin - bottomMargin
					minRequiredSpace := availableHeight * 0.4
					currentY := pdf.GetY()
					remainingSpace := pageHeight - bottomMargin - currentY

					if remainingSpace < minRequiredSpace || remainingSpace < estimatedNotesHeight {
						pdf.AddPage()
					}
				}

				pdf.Ln(5)

				if len(m.VehicleAssignments) > 0 {
					estimatedVehicleHeight := float64(len(m.VehicleAssignments)+1) * 15.0
					checkAndAddPageIfNeeded(estimatedVehicleHeight)
					drawVehicleAssignmentsTable(pdf, m, vehByID, partByID)
					pdf.Ln(5)
				}
			}
		}

		// End of day
		pdf.Ln(10)
		pdf.SetFont("Times", "B", 14)
		endDayText := formatEndDayText(d.Date)
		pdf.CellFormat(0, 10, endDayText, "", 0, "C", false, 0, "")
		pdf.Ln(10)
		pdf.AddPage()
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		http.Error(w, `{"error":"failed to generate pdf"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `inline; filename="my-itinerary.pdf"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(buf.Bytes())
}

func formatDateHeader(dateStr string) string {
	// Parse date string (YYYY-MM-DD format)
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return strings.ToUpper(dateStr) // Return original if parsing fails
	}

	// Format as "SUNDAY, SEPTEMBER 14, 2025" (all uppercase)
	dayName := strings.ToUpper(t.Format("Monday"))
	monthName := strings.ToUpper(t.Format("January"))
	day := t.Day()
	year := t.Year()

	return fmt.Sprintf("%s, %s %d, %d", dayName, monthName, day, year)
}

func formatEndDayText(dateStr string) string {
	// Parse date string (YYYY-MM-DD format)
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return "END DAY" // Return default if parsing fails
	}

	// Format as "END DAY THURSDAY 20th" (all uppercase)
	dayName := strings.ToUpper(t.Format("Monday"))
	day := t.Day()

	// Get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
	ordinal := getOrdinalSuffix(day)

	return fmt.Sprintf("END DAY %s %d%s", dayName, day, ordinal)
}

func getOrdinalSuffix(n int) string {
	// Handle special cases: 11th, 12th, 13th
	if n >= 11 && n <= 13 {
		return "th"
	}

	// Get last digit
	lastDigit := n % 10

	switch lastDigit {
	case 1:
		return "st"
	case 2:
		return "nd"
	case 3:
		return "rd"
	default:
		return "th"
	}
}

// Table rendering primitives
type TableAlignment string

const (
	AlignLeft   TableAlignment = "L"
	AlignCenter TableAlignment = "C"
	AlignRight  TableAlignment = "R"
)

type TableCell struct {
	Text           string
	Align          TableAlignment
	ColSpan        int
	BackgroundRGB  *[3]int // RGB values for background color (nil = no background)
	TextRGB        *[3]int // RGB values for text color (nil = default black)
	FontSize       float64 // Font size (0 = use table default)
	FontStyle      string  // Font style: "" (regular), "B" (bold), "I" (italic), "BI" (bold italic)
	GradientTopRGB *[3]int // RGB values for gradient top color (nil = use default gradient or solid)
	GradientBotRGB *[3]int // RGB values for gradient bottom color (nil = use default gradient or solid)
}

type TableRow struct {
	Cells []TableCell
}

type Table struct {
	X                   float64
	Y                   float64
	Width               float64
	ColumnWidths        []float64
	Padding             float64
	LineHeight          float64
	Border              bool
	Title               string
	TitleAlign          TableAlignment
	TitleBgRGB          *[3]int // RGB values for title background color (nil = no background)
	TitleTextRGB        *[3]int // RGB values for title text color (nil = default black)
	TitleGradientTopRGB *[3]int // RGB values for gradient top color (nil = no gradient, use TitleBgRGB)
	TitleGradientBotRGB *[3]int // RGB values for gradient bottom color (nil = no gradient, use TitleBgRGB)
	TitleFontStyle      string  // Font style for title: "" (regular), "B" (bold), "I" (italic), "BI" (bold italic). Default: "B"
	TitleFontSize       float64 // Font size for title (0 = use default 11)
	FontSize            float64 // Font size for table content (0 = use current/default)
	FontStyle           string  // Font style for table content: "" (regular), "B" (bold), "I" (italic), "BI" (bold italic)
	Rows                []TableRow
}

// renderTable draws a table starting at (X,Y). Returns the Y position after the table.
// It saves and restores the font state so the calling code doesn't need to worry about font changes.
func renderTable(pdf *gofpdf.Fpdf, t *Table) float64 {
	// Save current font state before rendering table
	ptSize, _ := pdf.GetFontSize()
	savedFontSize := ptSize
	// Note: gofpdf doesn't expose GetFont() for family/style, so we'll use "Times" as default
	// We'll save the font style by checking if we need to restore it
	savedFontStyle := "" // Default to regular

	// Determine table-level font size and style (for use in cells)
	tableFontSize := savedFontSize   // Default to saved font size
	tableFontStyle := savedFontStyle // Default to saved font style
	if t.FontSize > 0 {
		tableFontSize = t.FontSize
	}
	if t.FontStyle != "" {
		tableFontStyle = t.FontStyle
	}

	// Set table-level font size and style if specified
	if t.FontSize > 0 || t.FontStyle != "" {
		pdf.SetFont("Times", tableFontStyle, tableFontSize)
	}

	if t.Padding <= 0 {
		t.Padding = 2.0
	}
	if t.LineHeight <= 0 {
		t.LineHeight = 5.0
	}
	// Ensure column widths fit within table width
	totalColsWidth := 0.0
	for _, cw := range t.ColumnWidths {
		totalColsWidth += cw
	}
	if totalColsWidth > t.Width {
		// Scale down proportionally to fit
		scale := t.Width / totalColsWidth
		for i := range t.ColumnWidths {
			t.ColumnWidths[i] *= scale
		}
		totalColsWidth = t.Width
	}

	// Softer border color (gray instead of black)
	borderR, borderG, borderB := 200, 200, 200
	pdf.SetDrawColor(borderR, borderG, borderB)
	pdf.SetLineWidth(0.35) // ~1px at 72 DPI

	curX := t.X
	curY := t.Y

	// Optional title spanning full width
	// Always draw header row if gradient colors are set, even if title is empty
	hasTitleText := strings.TrimSpace(t.Title) != ""
	hasGradient := t.TitleGradientTopRGB != nil && t.TitleGradientBotRGB != nil
	hasSolidBg := t.TitleBgRGB != nil

	if hasTitleText || hasGradient || hasSolidBg {
		// Calculate title height
		titleHeight := t.LineHeight + (t.Padding * 2) // Default height
		if hasTitleText {
			innerW := totalColsWidth - (t.Padding * 2)
			lines := pdf.SplitText(t.Title, innerW)
			titleHeight = float64(len(lines))*t.LineHeight + (t.Padding * 2)
		}

		// Draw title background - gradient or solid
		if hasGradient {
			// Draw gradient by drawing multiple thin rectangles with interpolated colors
			gradientSteps := 50 // Number of steps for smooth gradient
			stepHeight := titleHeight / float64(gradientSteps)

			topR, topG, topB := float64(t.TitleGradientTopRGB[0]), float64(t.TitleGradientTopRGB[1]), float64(t.TitleGradientTopRGB[2])
			botR, botG, botB := float64(t.TitleGradientBotRGB[0]), float64(t.TitleGradientBotRGB[1]), float64(t.TitleGradientBotRGB[2])

			for i := 0; i < gradientSteps; i++ {
				// Interpolate color
				ratio := float64(i) / float64(gradientSteps-1)
				r := int(topR + (botR-topR)*ratio)
				g := int(topG + (botG-topG)*ratio)
				b := int(topB + (botB-topB)*ratio)

				pdf.SetFillColor(r, g, b)
				yPos := curY + float64(i)*stepHeight
				pdf.Rect(curX, yPos, totalColsWidth, stepHeight, "F")
			}
		} else if hasSolidBg {
			// Solid color background
			pdf.SetFillColor(t.TitleBgRGB[0], t.TitleBgRGB[1], t.TitleBgRGB[2])
			pdf.Rect(curX, curY, totalColsWidth, titleHeight, "F")
		}

		if t.Border {
			// Draw title border: top, left, right
			pdf.Line(curX, curY, curX+totalColsWidth, curY)                            // Top
			pdf.Line(curX, curY, curX, curY+titleHeight)                               // Left
			pdf.Line(curX+totalColsWidth, curY, curX+totalColsWidth, curY+titleHeight) // Right
			// Bottom border will be shared with first row
		}

		// Draw title text only if it exists
		if hasTitleText {
			// Set title text color if specified
			if t.TitleTextRGB != nil {
				pdf.SetTextColor(t.TitleTextRGB[0], t.TitleTextRGB[1], t.TitleTextRGB[2])
			} else {
				pdf.SetTextColor(0, 0, 0) // Default black
			}

			// Set title font style (default to "B" for bold)
			titleFontStyle := t.TitleFontStyle
			if titleFontStyle == "" {
				titleFontStyle = "B" // Default to bold
			}
			// Set title font size (default to 11)
			titleFontSize := t.TitleFontSize
			if titleFontSize <= 0 {
				titleFontSize = 12.0 // Default title font size
			}
			pdf.SetFont("Times", titleFontStyle, titleFontSize)

			// Set title alignment (default to "C" for center)
			titleAlign := string(t.TitleAlign)
			if titleAlign == "" {
				titleAlign = "C" // Default to center
			}

			innerW := totalColsWidth - (t.Padding * 2)
			pdf.SetXY(curX+t.Padding, curY+t.Padding)
			pdf.MultiCell(innerW, t.LineHeight, t.Title, "", titleAlign, false)

			// Restore font after title
			pdf.SetFont("Times", tableFontStyle, tableFontSize)

			// Restore default text color
			pdf.SetTextColor(0, 0, 0)
		}

		curY += titleHeight
	}

	// Rows
	for rowIdx, row := range t.Rows {
		// Compute row height as the max cell height
		// Need to use correct font size for text wrapping calculation
		colIdx := 0
		rowHeight := 0.0
		for _, cell := range row.Cells {
			span := cell.ColSpan
			if span <= 0 {
				span = 1
			}
			spanWidth := 0.0
			for i := 0; i < span && (colIdx+i) < len(t.ColumnWidths); i++ {
				spanWidth += t.ColumnWidths[colIdx+i]
			}
			innerW := spanWidth - (t.Padding * 2)
			if innerW < 1 {
				innerW = 1
			}

			// Set font to calculate text wrapping correctly
			cellFontSize := tableFontSize
			if cell.FontSize > 0 {
				cellFontSize = cell.FontSize
			}
			cellFontStyle := tableFontStyle
			if cell.FontStyle != "" {
				cellFontStyle = cell.FontStyle
			}
			pdf.SetFont("Times", cellFontStyle, cellFontSize)

			lines := pdf.SplitText(cell.Text, innerW)
			// Use cell font size for line height calculation (approximate: font size * 0.5)
			cellLineHeight := cellFontSize * 0.5
			if cellLineHeight < 4.0 {
				cellLineHeight = 4.0
			}
			h := float64(len(lines))*cellLineHeight + (t.Padding * 2)
			if h > rowHeight {
				rowHeight = h
			}
			colIdx += span
		}
		if rowHeight < t.LineHeight+(t.Padding*2) {
			rowHeight = t.LineHeight + (t.Padding * 2)
		}

		// Draw row cells
		colIdx = 0
		cellX := curX
		isFirstRow := rowIdx == 0

		// If first row and has background colors, draw gradient background for entire row
		if isFirstRow && len(row.Cells) > 0 && row.Cells[0].BackgroundRGB != nil {
			// Check if we should use gradient (if all cells have the same background color, treat as gradient row)
			// For now, we'll use a simple approach: if first cell has background, draw gradient for entire row
			gradientSteps := 50
			stepHeight := rowHeight / float64(gradientSteps)

			// Use gradient colors from first cell if specified, otherwise use default event gradient
			var topR, topG, topB, botR, botG, botB float64
			if len(row.Cells) > 0 && row.Cells[0].GradientTopRGB != nil && row.Cells[0].GradientBotRGB != nil {
				// Use gradient from cell
				topR, topG, topB = float64(row.Cells[0].GradientTopRGB[0]), float64(row.Cells[0].GradientTopRGB[1]), float64(row.Cells[0].GradientTopRGB[2])
				botR, botG, botB = float64(row.Cells[0].GradientBotRGB[0]), float64(row.Cells[0].GradientBotRGB[1]), float64(row.Cells[0].GradientBotRGB[2])
			} else {
				// Default gradient colors: top (198, 123, 129) to bottom (135, 18, 27) for events
				topR, topG, topB = 198.0, 123.0, 129.0
				botR, botG, botB = 135.0, 18.0, 27.0
			}

			for i := 0; i < gradientSteps; i++ {
				ratio := float64(i) / float64(gradientSteps-1)
				r := int(topR + (botR-topR)*ratio)
				g := int(topG + (botG-topG)*ratio)
				b := int(topB + (botB-topB)*ratio)

				pdf.SetFillColor(r, g, b)
				yPos := curY + float64(i)*stepHeight
				pdf.Rect(curX, yPos, totalColsWidth, stepHeight, "F")
			}
		}

		for cellIdx, cell := range row.Cells {
			span := cell.ColSpan
			if span <= 0 {
				span = 1
			}
			spanWidth := 0.0
			for i := 0; i < span && (colIdx+i) < len(t.ColumnWidths); i++ {
				spanWidth += t.ColumnWidths[colIdx+i]
			}

			// Determine which borders to draw (avoid double borders)
			isFirstCol := cellIdx == 0

			// Draw cell background if specified (but skip if first row - gradient already drawn)
			if cell.BackgroundRGB != nil && !isFirstRow {
				pdf.SetFillColor(cell.BackgroundRGB[0], cell.BackgroundRGB[1], cell.BackgroundRGB[2])
				pdf.Rect(cellX, curY, spanWidth, rowHeight, "F")
			}

			// Draw borders selectively to avoid double borders
			if t.Border {
				// Top border: only if first row and no title (title already has bottom border)
				if isFirstRow && strings.TrimSpace(t.Title) == "" {
					pdf.Line(cellX, curY, cellX+spanWidth, curY)
				}
				// Left border: only if first column (outer edge)
				if isFirstCol {
					pdf.Line(cellX, curY, cellX, curY+rowHeight)
				}
				// Right border: special handling for header row (only if row has BackgroundRGB set)
				// Check if this is a header row by checking if any cell has BackgroundRGB
				isHeaderRow := isFirstRow && len(row.Cells) > 0 && row.Cells[0].BackgroundRGB != nil
				if isHeaderRow {
					// For header row, skip right border for all cells except the last one
					// This makes the borders between header cells invisible (transparent effect)
					isLastCol := cellIdx == len(row.Cells)-1
					if isLastCol {
						// Last cell: draw normal border (outer edge)
						pdf.Line(cellX+spanWidth, curY, cellX+spanWidth, curY+rowHeight)
					}
					// For non-last cells, don't draw right border (transparent effect)
				} else {
					// Non-header rows: always draw (shared with next cell, or outer edge if last column)
					pdf.Line(cellX+spanWidth, curY, cellX+spanWidth, curY+rowHeight)
				}
				// Bottom border: always draw (shared with next row, or outer edge if last row)
				pdf.Line(cellX, curY+rowHeight, cellX+spanWidth, curY+rowHeight)
			}

			// Set text color if specified
			if cell.TextRGB != nil {
				pdf.SetTextColor(cell.TextRGB[0], cell.TextRGB[1], cell.TextRGB[2])
			} else {
				pdf.SetTextColor(0, 0, 0) // Default black
			}

			// Set font size and style if specified (cell-level overrides table-level)
			fontSize := tableFontSize // Default to table-level font size
			if cell.FontSize > 0 {
				fontSize = cell.FontSize // Cell-level overrides
			}
			fontStyle := tableFontStyle // Default to table-level font style
			if cell.FontStyle != "" {
				fontStyle = cell.FontStyle // Cell-level overrides
			}
			pdf.SetFont("Times", fontStyle, fontSize)

			textW := spanWidth - (t.Padding * 2)
			if textW < 1 {
				textW = 1
			}
			pdf.SetXY(cellX+t.Padding, curY+t.Padding)
			pdf.MultiCell(textW, t.LineHeight, cell.Text, "", string(cell.Align), false)

			// Restore text color
			pdf.SetTextColor(0, 0, 0)
			// Restore font to table-level font (will be restored fully after table)
			pdf.SetFont("Times", tableFontStyle, tableFontSize)

			// Move to next cell
			cellX += spanWidth
			colIdx += span
		}
		curY += rowHeight
	}

	// Restore default draw color
	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.2) // Restore default line width

	// Restore font state (size and style) to what it was before rendering the table
	pdf.SetFont("Times", savedFontStyle, savedFontSize)

	return curY
}

// drawLineByLineTable draws the "Line by line" table for schedule items
func drawLineByLineTable(pdf *gofpdf.Fpdf, b models.Block) {
	margin := 12.0
	pageWidth := 297.0 - (margin * 2)
	startX := margin

	// "Line by line: " text (bold, underlined, left-aligned)
	pdf.SetFont("Times", "BU", 11) // Bold and Underline
	pdf.SetX(startX)
	pdf.CellFormat(0, 6, "Line by line: ", "", 0, "L", false, 0, "")
	pdf.Ln(8)

	// Column widths: Time (small), Description (longer), Notes (medium), Guest/Staff (medium)
	timeWidth := 20.0
	notesWidth := 50.0
	guestStaffWidth := 50.0
	descriptionWidth := pageWidth - timeWidth - notesWidth - guestStaffWidth

	// Header gradient colors (used to mark header row for gradient rendering)
	headerGradientTopRGB := [3]int{198, 123, 129}
	headerTextRGB := [3]int{189, 168, 109}

	// Build header row with gradient background marker
	// The gradient will be rendered by renderTable when it detects BackgroundRGB on first row
	headerRow := TableRow{
		Cells: []TableCell{
			{Text: "Time", Align: AlignLeft, ColSpan: 1, FontSize: 9, FontStyle: "B", BackgroundRGB: &headerGradientTopRGB, TextRGB: &headerTextRGB},
			{Text: "Description", Align: AlignLeft, ColSpan: 1, FontSize: 9, FontStyle: "B", BackgroundRGB: &headerGradientTopRGB, TextRGB: &headerTextRGB},
			{Text: "Notes", Align: AlignLeft, ColSpan: 1, FontSize: 9, FontStyle: "B", BackgroundRGB: &headerGradientTopRGB, TextRGB: &headerTextRGB},
			{Text: "Guest / Staff", Align: AlignLeft, ColSpan: 1, FontSize: 9, FontStyle: "B", BackgroundRGB: &headerGradientTopRGB, TextRGB: &headerTextRGB},
		},
	}

	// Build data rows from schedule items
	dataRows := make([]TableRow, 0, len(b.ScheduleItems))
	for _, si := range b.ScheduleItems {
		// Format guest/staff instructions
		guestStaffText := ""
		if si.StaffInstructions != "" && si.GuestInstructions != "" {
			if si.StaffInstructions == si.GuestInstructions {
				guestStaffText = si.StaffInstructions
			} else {
				guestStaffText = "Staff: " + si.StaffInstructions + "\nGuest: " + si.GuestInstructions
			}
		} else if si.StaffInstructions != "" {
			guestStaffText = "Staff: " + si.StaffInstructions
		} else if si.GuestInstructions != "" {
			guestStaffText = "Guest: " + si.GuestInstructions
		}

		notesText := ""
		notesAlign := AlignLeft
		if si.Notes != nil && *si.Notes != "" {
			notesText = *si.Notes
		} else {
			notesText = "-"
			notesAlign = AlignCenter
		}

		guestStaffAlign := AlignLeft
		if guestStaffText == "" {
			guestStaffText = "-"
			guestStaffAlign = AlignCenter
		}

		dataRows = append(dataRows, TableRow{
			Cells: []TableCell{
				{Text: si.Time, Align: AlignLeft, ColSpan: 1},
				{Text: si.Description, Align: AlignLeft, ColSpan: 1},
				{Text: notesText, Align: notesAlign, ColSpan: 1},
				{Text: guestStaffText, Align: guestStaffAlign, ColSpan: 1},
			},
		})
	}

	// Create table without top header (no red gradient)
	lineByLineTable := &Table{
		X:            startX,
		Y:            pdf.GetY(),
		Width:        pageWidth,
		ColumnWidths: []float64{timeWidth, descriptionWidth, notesWidth, guestStaffWidth},
		Padding:      2.0,
		LineHeight:   4.0,
		Border:       true,
		Title:        "", // No title/header
		FontSize:     9.0,
		FontStyle:    "",
		Rows:         append([]TableRow{headerRow}, dataRows...),
	}

	renderTable(pdf, lineByLineTable)
}

// drawEventDescriptionTables draws the event description table (left) and notes table (right) if notes exist
func drawEventDescriptionTables(pdf *gofpdf.Fpdf, b models.Block, locByID map[string]models.Location, partByID map[string]models.Participant) {
	margin := 12.0
	startY := pdf.GetY()
	startX := margin

	// Left table: Event description (max width 120)
	descTableWidth := 120.0
	descRows := make([]TableRow, 0, 3)

	// Description row
	if b.Description != "" {
		descRows = append(descRows, TableRow{
			Cells: []TableCell{
				{Text: "Description", Align: AlignLeft, ColSpan: 1},
				{Text: b.Description, Align: AlignLeft, ColSpan: 1},
			},
		})
	}

	// Location row
	locationName := "-"
	if b.LocationID != nil && *b.LocationID != "" {
		if loc, ok := locByID[*b.LocationID]; ok {
			locationName = loc.Name
		}
	}
	descRows = append(descRows, TableRow{
		Cells: []TableCell{
			{Text: "Location", Align: AlignLeft, ColSpan: 1},
			{Text: locationName, Align: AlignLeft, ColSpan: 1},
		},
	})

	// Number of participants row
	participantCount := len(b.ParticipantsIds)
	descRows = append(descRows, TableRow{
		Cells: []TableCell{
			{Text: "Number of participants", Align: AlignLeft, ColSpan: 1},
			{Text: fmt.Sprintf("%d", participantCount), Align: AlignLeft, ColSpan: 1},
		},
	})

	// Advance participants row
	if len(b.AdvanceParticipantIDs) > 0 {
		advanceNames := make([]string, 0, len(b.AdvanceParticipantIDs))
		for _, pid := range b.AdvanceParticipantIDs {
			if p, ok := partByID[pid]; ok {
				advanceNames = append(advanceNames, p.Name)
			}
		}
		advanceText := strings.Join(advanceNames, ", ")
		if advanceText != "" {
			descRows = append(descRows, TableRow{
				Cells: []TableCell{
					{Text: "Advance", Align: AlignLeft, ColSpan: 1},
					{Text: advanceText, Align: AlignLeft, ColSpan: 1},
				},
			})
		}
	}

	// Met By participants row
	if len(b.MetByParticipantIDs) > 0 {
		metByNames := make([]string, 0, len(b.MetByParticipantIDs))
		for _, pid := range b.MetByParticipantIDs {
			if p, ok := partByID[pid]; ok {
				metByNames = append(metByNames, p.Name)
			}
		}
		metByText := strings.Join(metByNames, ", ")
		if metByText != "" {
			descRows = append(descRows, TableRow{
				Cells: []TableCell{
					{Text: "Met By", Align: AlignLeft, ColSpan: 1},
					{Text: metByText, Align: AlignLeft, ColSpan: 1},
				},
			})
		}
	}

	// Header gradient colors
	titleGradientTopRGB := [3]int{198, 123, 129}
	titleGradientBotRGB := [3]int{135, 18, 27}
	titleTextRGB := [3]int{189, 168, 109}

	// Create description table (left side)
	// This is a regular table (not line-by-line), so all borders should be normal gray
	// No title in the table header - title is shown above
	descTable := &Table{
		X:                   startX,
		Y:                   startY,
		Width:               descTableWidth,
		ColumnWidths:        []float64{descTableWidth * 0.4, descTableWidth * 0.6},
		Padding:             2.0,
		LineHeight:          5.0,
		Border:              true,
		Title:               "", // No title - shown above as text, but header row still appears
		TitleAlign:          AlignLeft,
		TitleGradientTopRGB: &titleGradientTopRGB,
		TitleGradientBotRGB: &titleGradientBotRGB,
		TitleTextRGB:        &titleTextRGB,
		FontSize:            10.0, // Table-level font size (1 point smaller)
		FontStyle:           "",   // Regular style
		Rows:                descRows,
	}

	// Event name - centered on whole page, bold, underlined (before the table)
	// Calculate position to center on full page width (297mm landscape)
	pageWidth := 297.0
	pdf.SetFont("Times", "BU", 14)                                  // Bigger font (was 12)
	pdf.SetX(0)                                                     // Start from left edge
	pdf.CellFormat(pageWidth, 8, b.Title, "", 0, "C", false, 0, "") // Centered on full page
	pdf.Ln(10)                                                      // Add spacing after title

	// Now render the table starting at the current Y position
	descTable.Y = pdf.GetY()

	descEndY := renderTable(pdf, descTable)

	// Right table: Notes (if notes exist, width 80, aligned to right margin)
	if b.Notes != "" {
		notesTableWidth := 80.0
		// Landscape page width: 297mm, right margin: 12mm
		// X position = page width - right margin - table width
		pageWidth := 297.0
		rightMargin := 12.0
		notesTableX := pageWidth - rightMargin - notesTableWidth

		notesRows := []TableRow{
			{
				Cells: []TableCell{
					{Text: b.Notes, Align: AlignLeft, ColSpan: 1},
				},
			},
		}

		// Notes table should align with description table (which starts after event name text)
		// Event name text height is 8mm, so notes table Y = descTable.Y (same as description table)
		notesTableY := descTable.Y

		notesTable := &Table{
			X:                   notesTableX,
			Y:                   notesTableY,
			Width:               notesTableWidth,
			ColumnWidths:        []float64{notesTableWidth},
			Padding:             2.0,
			LineHeight:          5.0,
			Border:              true,
			Title:               "NOTES",
			TitleAlign:          AlignCenter,
			TitleGradientTopRGB: &titleGradientTopRGB,
			TitleGradientBotRGB: &titleGradientBotRGB,
			TitleTextRGB:        &titleTextRGB,
			FontSize:            9.0, // Table-level font size
			FontStyle:           "",  // Regular style
			Rows:                notesRows,
		}

		notesEndY := renderTable(pdf, notesTable)

		// Set Y to the maximum of both table heights
		if notesEndY > descEndY {
			pdf.SetY(notesEndY)
		} else {
			pdf.SetY(descEndY)
		}
	} else {
		pdf.SetY(descEndY)
	}
}

func drawBlockBox(pdf *gofpdf.Fpdf, b models.Block, locByID map[string]models.Location, partByID map[string]models.Participant) {
	margin := 12.0
	pageWidth := 210.0 - (margin * 2)
	x := margin

	// Build rows in table format
	rows := make([]TableRow, 0, 8)

	// Advance (at the beginning of the event)
	if len(b.AdvanceParticipantIDs) > 0 {
		names := make([]string, 0, len(b.AdvanceParticipantIDs))
		for _, pid := range b.AdvanceParticipantIDs {
			if p, ok := partByID[pid]; ok {
				names = append(names, p.Name)
			}
		}
		rows = append(rows, TableRow{
			Cells: []TableCell{
				{Text: "Advance:", Align: AlignRight, ColSpan: 1},
				{Text: strings.Join(names, "\n"), Align: AlignLeft, ColSpan: 1},
			},
		})
	}

	// Met By (at the beginning of the event)
	if len(b.MetByParticipantIDs) > 0 {
		names := make([]string, 0, len(b.MetByParticipantIDs))
		for _, pid := range b.MetByParticipantIDs {
			if p, ok := partByID[pid]; ok {
				names = append(names, p.Name)
			}
		}
		rows = append(rows, TableRow{
			Cells: []TableCell{
				{Text: "Met By:", Align: AlignRight, ColSpan: 1},
				{Text: strings.Join(names, "\n"), Align: AlignLeft, ColSpan: 1},
			},
		})
	}

	// Schedule items
	for _, si := range b.ScheduleItems {
		rows = append(rows, TableRow{
			Cells: []TableCell{
				{Text: si.Time, Align: AlignRight, ColSpan: 1},
				{Text: si.Description, Align: AlignLeft, ColSpan: 1},
			},
		})

		// Staff/Guest Instructions as full-width row(s)
		hasStaff := si.StaffInstructions != ""
		hasGuest := si.GuestInstructions != ""
		if hasStaff || hasGuest {
			if hasStaff && hasGuest && si.StaffInstructions == si.GuestInstructions {
				rows = append(rows, TableRow{
					Cells: []TableCell{
						{Text: "STAFF / GUEST INSTRUCTIONS:\n" + si.StaffInstructions, Align: AlignLeft, ColSpan: 2},
					},
				})
			} else {
				if hasStaff {
					rows = append(rows, TableRow{
						Cells: []TableCell{
							{Text: "STAFF INSTRUCTIONS:\n" + si.StaffInstructions, Align: AlignLeft, ColSpan: 2},
						},
					})
				}
				if hasGuest {
					rows = append(rows, TableRow{
						Cells: []TableCell{
							{Text: "GUEST INSTRUCTIONS:\n" + si.GuestInstructions, Align: AlignLeft, ColSpan: 2},
						},
					})
				}
			}
		}

		// Schedule item notes as full-width row
		if si.Notes != nil && *si.Notes != "" {
			rows = append(rows, TableRow{
				Cells: []TableCell{
					{Text: "NOTE: " + *si.Notes, Align: AlignLeft, ColSpan: 2},
				},
			})
		}
	}

	// Block-level notes
	if b.Notes != "" {
		rows = append(rows, TableRow{
			Cells: []TableCell{
				{Text: "NOTE: " + b.Notes, Align: AlignLeft, ColSpan: 2},
			},
		})
	}

	// Create table with two columns
	// Header gradient: top RGB(198, 123, 129) to bottom RGB(135, 18, 27), text RGB(189, 168, 109)
	titleGradientTopRGB := [3]int{198, 123, 129}
	titleGradientBotRGB := [3]int{135, 18, 27}
	titleTextRGB := [3]int{189, 168, 109}
	table := &Table{
		X:                   x,
		Y:                   pdf.GetY(),
		Width:               pageWidth,
		ColumnWidths:        []float64{40, pageWidth - 40},
		Padding:             2.0,
		LineHeight:          5.0,
		Border:              true,
		Title:               "Event:            " + b.Title,
		TitleAlign:          AlignCenter,
		TitleGradientTopRGB: &titleGradientTopRGB,
		TitleGradientBotRGB: &titleGradientBotRGB,
		TitleTextRGB:        &titleTextRGB,
		Rows:                rows,
	}

	endY := renderTable(pdf, table)
	pdf.SetY(endY + 5)
}

// drawMovementDescriptionTables draws the movement description table (left) and notes table (right) if notes exist
func drawMovementDescriptionTables(pdf *gofpdf.Fpdf, m models.Movement, locByID map[string]models.Location) {
	margin := 12.0
	startY := pdf.GetY()
	startX := margin

	// Left table: Movement description (max width 120)
	descTableWidth := 120.0
	descRows := make([]TableRow, 0, 5)

	// Title row
	descRows = append(descRows, TableRow{
		Cells: []TableCell{
			{Text: "Title", Align: AlignLeft, ColSpan: 1},
			{Text: m.Title, Align: AlignLeft, ColSpan: 1},
		},
	})

	// From/To row
	from := "-"
	to := "-"
	if l, ok := locByID[m.FromLocationID]; ok && m.FromLocationID != "" {
		from = l.Name
	}
	if l, ok := locByID[m.ToLocationID]; ok && m.ToLocationID != "" {
		to = l.Name
	}
	descRows = append(descRows, TableRow{
		Cells: []TableCell{
			{Text: "Route", Align: AlignLeft, ColSpan: 1},
			{Text: from + " → " + to, Align: AlignLeft, ColSpan: 1},
		},
	})

	// Departure time row
	descRows = append(descRows, TableRow{
		Cells: []TableCell{
			{Text: "Departure", Align: AlignLeft, ColSpan: 1},
			{Text: m.FromTime, Align: AlignLeft, ColSpan: 1},
		},
	})

	// Arrival/Driving time row
	if m.ToTimeType == "fixed" {
		descRows = append(descRows, TableRow{
			Cells: []TableCell{
				{Text: "Arrival", Align: AlignLeft, ColSpan: 1},
				{Text: m.ToTime, Align: AlignLeft, ColSpan: 1},
			},
		})
	} else {
		// Driving time
		drivingTimeStr := ""
		if m.DrivingTimeHours != nil && *m.DrivingTimeHours > 0 {
			drivingTimeStr = fmt.Sprintf("%d hour", *m.DrivingTimeHours)
			if *m.DrivingTimeHours > 1 {
				drivingTimeStr += "s"
			}
		}
		if m.DrivingTimeMinutes != nil && *m.DrivingTimeMinutes > 0 {
			if drivingTimeStr != "" {
				drivingTimeStr += " "
			}
			drivingTimeStr += fmt.Sprintf("%d minute", *m.DrivingTimeMinutes)
			if *m.DrivingTimeMinutes > 1 {
				drivingTimeStr += "s"
			}
		}
		if drivingTimeStr == "" {
			drivingTimeStr = "-"
		}
		descRows = append(descRows, TableRow{
			Cells: []TableCell{
				{Text: "Driving Time", Align: AlignLeft, ColSpan: 1},
				{Text: drivingTimeStr, Align: AlignLeft, ColSpan: 1},
			},
		})
	}

	// Description row (if exists)
	if m.Description != "" {
		descRows = append(descRows, TableRow{
			Cells: []TableCell{
				{Text: "Description", Align: AlignLeft, ColSpan: 1},
				{Text: m.Description, Align: AlignLeft, ColSpan: 1},
			},
		})
	}

	// Header gradient colors for movements (different from events)
	titleGradientTopRGB := [3]int{210, 173, 176} // Different gradient for movements (top)
	titleGradientBotRGB := [3]int{153, 102, 107} // Different gradient for movements (bottom)
	titleTextRGB := [3]int{189, 168, 109}

	// Create description table (left side)
	// No title in the table header - title is shown above
	descTable := &Table{
		X:                   startX,
		Y:                   startY,
		Width:               descTableWidth,
		ColumnWidths:        []float64{descTableWidth * 0.4, descTableWidth * 0.6},
		Padding:             2.0,
		LineHeight:          5.0,
		Border:              true,
		Title:               "", // No title - shown above as text, but header row still appears
		TitleAlign:          AlignLeft,
		TitleGradientTopRGB: &titleGradientTopRGB,
		TitleGradientBotRGB: &titleGradientBotRGB,
		TitleTextRGB:        &titleTextRGB,
		FontSize:            10.0, // Table-level font size (1 point smaller)
		FontStyle:           "",
		Rows:                descRows,
	}

	// Movement title - centered on whole page, bold, underlined (before the table)
	// Calculate position to center on full page width (297mm landscape)
	pageWidth := 297.0
	pdf.SetFont("Times", "BU", 14)                                  // Bigger font (was 12)
	pdf.SetX(0)                                                     // Start from left edge
	pdf.CellFormat(pageWidth, 8, m.Title, "", 0, "C", false, 0, "") // Centered on full page
	pdf.Ln(10)                                                      // Add spacing after title

	// Now render the table starting at the current Y position
	descTable.Y = pdf.GetY()

	descEndY := renderTable(pdf, descTable)
	pdf.SetY(descEndY)

	// Right table: Notes (if notes exist, width 80, aligned to right margin)
	if m.Notes != "" {
		notesTableWidth := 80.0
		pageWidth := 297.0
		rightMargin := 12.0
		notesTableX := pageWidth - rightMargin - notesTableWidth

		notesRows := []TableRow{
			{
				Cells: []TableCell{
					{Text: m.Notes, Align: AlignLeft, ColSpan: 1},
				},
			},
		}

		// Notes table should align with description table (which starts after route text)
		// Notes table Y = descTable.Y (same as description table)
		notesTableY := descTable.Y

		notesTable := &Table{
			X:                   notesTableX,
			Y:                   notesTableY,
			Width:               notesTableWidth,
			ColumnWidths:        []float64{notesTableWidth},
			Padding:             2.0,
			LineHeight:          5.0,
			Border:              true,
			Title:               "NOTES",
			TitleAlign:          AlignCenter,
			TitleGradientTopRGB: &titleGradientTopRGB,
			TitleGradientBotRGB: &titleGradientBotRGB,
			TitleTextRGB:        &titleTextRGB,
			FontSize:            9.0,
			FontStyle:           "",
			Rows:                notesRows,
		}

		notesEndY := renderTable(pdf, notesTable)

		// Set Y to the maximum of both table heights
		if notesEndY > descEndY {
			pdf.SetY(notesEndY)
		} else {
			pdf.SetY(descEndY)
		}
	} else {
		pdf.SetY(descEndY)
	}
}

// drawVehicleAssignmentsTable draws a table with vehicle assignment information
func drawVehicleAssignmentsTable(pdf *gofpdf.Fpdf, m models.Movement, vehByID map[string]models.Vehicle, partByID map[string]models.Participant) {
	margin := 12.0
	pageWidth := 297.0 - (margin * 2)
	startX := margin

	// "VEHICLE ASSIGNMENTS:" text (bold, underlined, left-aligned)
	pdf.SetFont("Times", "BU", 11) // Bold and Underline
	pdf.SetX(startX)
	pdf.CellFormat(0, 6, "VEHICLE ASSIGNMENTS:", "", 0, "L", false, 0, "")
	pdf.Ln(6)

	// Build header row (same gradient as movements)
	headerGradientTopRGB := [3]int{210, 173, 176} // Same gradient as movements (top)
	headerGradientBotRGB := [3]int{153, 102, 107} // Same gradient as movements (bottom)
	headerTextRGB := [3]int{255, 255, 255}        // White text

	headerRow := TableRow{
		Cells: []TableCell{
			{Text: "Vehicle", Align: AlignLeft, ColSpan: 1, FontSize: 9, FontStyle: "B", BackgroundRGB: &headerGradientTopRGB, TextRGB: &headerTextRGB, GradientTopRGB: &headerGradientTopRGB, GradientBotRGB: &headerGradientBotRGB},
			{Text: "Participants", Align: AlignLeft, ColSpan: 1, FontSize: 9, FontStyle: "B", BackgroundRGB: &headerGradientTopRGB, TextRGB: &headerTextRGB, GradientTopRGB: &headerGradientTopRGB, GradientBotRGB: &headerGradientBotRGB},
			{Text: "Make/Model", Align: AlignLeft, ColSpan: 1, FontSize: 9, FontStyle: "B", BackgroundRGB: &headerGradientTopRGB, TextRGB: &headerTextRGB, GradientTopRGB: &headerGradientTopRGB, GradientBotRGB: &headerGradientBotRGB},
			{Text: "License", Align: AlignLeft, ColSpan: 1, FontSize: 9, FontStyle: "B", BackgroundRGB: &headerGradientTopRGB, TextRGB: &headerTextRGB, GradientTopRGB: &headerGradientTopRGB, GradientBotRGB: &headerGradientBotRGB},
			{Text: "Seats", Align: AlignLeft, ColSpan: 1, FontSize: 9, FontStyle: "B", BackgroundRGB: &headerGradientTopRGB, TextRGB: &headerTextRGB, GradientTopRGB: &headerGradientTopRGB, GradientBotRGB: &headerGradientBotRGB},
			{Text: "Driver", Align: AlignLeft, ColSpan: 1, FontSize: 9, FontStyle: "B", BackgroundRGB: &headerGradientTopRGB, TextRGB: &headerTextRGB, GradientTopRGB: &headerGradientTopRGB, GradientBotRGB: &headerGradientBotRGB},
		},
	}

	// Build data rows from vehicle assignments
	dataRows := make([]TableRow, 0, len(m.VehicleAssignments))
	for _, a := range m.VehicleAssignments {
		v, ok := vehByID[a.VehicleID]
		if !ok {
			continue
		}

		// Vehicle label
		vehicleLabel := v.Label
		if vehicleLabel == "" {
			vehicleLabel = a.VehicleID
		}

		// Make/Model
		makeModel := ""
		if v.Make != "" && v.Model != "" {
			makeModel = v.Make + " " + v.Model
		} else if v.Make != "" {
			makeModel = v.Make
		} else if v.Model != "" {
			makeModel = v.Model
		} else {
			makeModel = "-"
		}

		// License plate
		licensePlate := v.LicensePlate
		if licensePlate == "" {
			licensePlate = "-"
		}

		// Capacity
		capacityStr := "-"
		if v.Capacity != nil {
			capacityStr = fmt.Sprintf("%d", *v.Capacity)
		}

		// Driver
		driverName := "-"
		if a.DriverID != nil && *a.DriverID != "" {
			if driver, ok := partByID[*a.DriverID]; ok {
				driverName = driver.Name
			}
		}

		// Participants (excluding driver)
		participantNames := make([]string, 0)
		for _, pid := range a.ParticipantIDs {
			if a.DriverID == nil || pid != *a.DriverID {
				if p, ok := partByID[pid]; ok {
					participantNames = append(participantNames, p.Name)
				}
			}
		}
		participantsStr := strings.Join(participantNames, ", ")
		if participantsStr == "" {
			participantsStr = "-"
		}

		dataRows = append(dataRows, TableRow{
			Cells: []TableCell{
				{Text: vehicleLabel, Align: AlignLeft, ColSpan: 1},
				{Text: participantsStr, Align: AlignLeft, ColSpan: 1},
				{Text: makeModel, Align: AlignLeft, ColSpan: 1},
				{Text: licensePlate, Align: AlignLeft, ColSpan: 1},
				{Text: capacityStr, Align: AlignLeft, ColSpan: 1},
				{Text: driverName, Align: AlignLeft, ColSpan: 1},
			},
		})
	}

	// Column widths: Vehicle (smaller), Participants (larger, second column), Make/Model (smaller), License (smaller), Seats (even smaller), Driver (keep same)
	vehicleWidth := pageWidth * 0.12      // Smaller
	participantsWidth := pageWidth * 0.45 // Larger (second column)
	makeModelWidth := pageWidth * 0.12    // Smaller
	licenseWidth := pageWidth * 0.10      // Smaller
	seatsWidth := pageWidth * 0.06        // Even smaller (was Capacity)
	driverWidth := pageWidth * 0.15       // Keep same (don't change)

	// Create table
	vehicleTable := &Table{
		X:            startX,
		Y:            pdf.GetY(),
		Width:        pageWidth,
		ColumnWidths: []float64{vehicleWidth, participantsWidth, makeModelWidth, licenseWidth, seatsWidth, driverWidth},
		Padding:      2.0,
		LineHeight:   4.0,
		Border:       true,
		Title:        "", // No title/header (we have the "VEHICLE ASSIGNMENTS:" text above)
		FontSize:     9.0,
		FontStyle:    "",
		Rows:         append([]TableRow{headerRow}, dataRows...),
	}

	renderTable(pdf, vehicleTable)
}

func drawMovementBox(pdf *gofpdf.Fpdf, m models.Movement, locByID map[string]models.Location, vehByID map[string]models.Vehicle, partByID map[string]models.Participant) {
	startY := pdf.GetY()
	margin := 12.0
	pageWidth := 210.0 - (margin * 2)
	x := margin
	padding := 3.0
	columnWidth := (pageWidth - (padding * 3)) / 2 // Two columns with spacing

	// Calculate content height
	from := "-"
	to := "-"
	if l, ok := locByID[m.FromLocationID]; ok && m.FromLocationID != "" {
		from = l.Name
	}
	if l, ok := locByID[m.ToLocationID]; ok && m.ToLocationID != "" {
		to = l.Name
	}

	// Calculate vehicles section height
	vehiclesY := startY + padding

	// Calculate how much space vehicles will take
	for _, a := range m.VehicleAssignments {
		// Vehicle label line
		vehiclesY += 6
		// Participants (including driver if present)
		participantCount := len(a.ParticipantIDs)
		if a.DriverID != nil && *a.DriverID != "" {
			participantCount++
		}
		vehiclesY += float64(participantCount) * 5
		vehiclesY += 3 // spacing between vehicles
	}

	// Calculate total content height
	contentY := startY + padding
	pdf.SetFont("Times", "B", 11)
	header := fmt.Sprintf("%s  %s  %s → %s", m.Title, m.FromTime, from, to)
	contentY += 6 // header

	pdf.SetFont("Times", "", 10)
	if m.Description != "" {
		contentY += 5
	}
	// Arrival - only if fixed
	if m.ToTimeType == "fixed" {
		contentY += 5
	}
	contentY += 5 // spacing before vehicles

	// Use the larger of the two heights
	finalY := contentY
	if vehiclesY > contentY {
		finalY = vehiclesY
	}
	boxHeight := finalY - startY + padding

	// Draw box border
	pdf.Rect(x, startY, pageWidth, boxHeight, "D")

	// Draw content
	pdf.SetXY(x+padding, startY+padding)
	pdf.SetFont("Times", "B", 11)
	pdf.MultiCell(pageWidth-(padding*2), 6, header, "", "L", false)

	pdf.SetFont("Times", "", 10)
	if m.Description != "" {
		pdf.MultiCell(pageWidth-(padding*2), 5, m.Description, "", "L", false)
	}

	// Arrival - only show if fixed time
	if m.ToTimeType == "fixed" {
		pdf.SetX(x + padding)
		pdf.MultiCell(pageWidth-(padding*2), 5, "Arrival at: "+m.ToTime, "", "L", false)
	}

	// Vehicles section - two column layout
	if len(m.VehicleAssignments) > 0 {
		pdf.Ln(3)
		// Title: "Vehicle Assignments" (bold and underline)
		pdf.SetX(x + padding)
		pdf.SetFont("Times", "BU", 11) // Bold and Underline
		pdf.Cell(pageWidth-(padding*2), 6, "VEHICLE ASSIGNMENTS:")
		pdf.Ln(8) // More spacing after title

		currentY := pdf.GetY()
		column1X := x + padding
		column2X := x + padding + columnWidth + padding
		currentColumnX := column1X
		maxY := currentY

		for _, a := range m.VehicleAssignments {
			vlabel := a.VehicleID
			if v, ok := vehByID[a.VehicleID]; ok && v.Label != "" {
				vlabel = v.Label
			}

			// Check if we need to move to second column
			if currentColumnX == column1X && pdf.GetY() > currentY+50 {
				currentColumnX = column2X
				pdf.SetXY(currentColumnX, currentY)
			}

			// Vehicle label (bold and underline)
			pdf.SetXY(currentColumnX, pdf.GetY())
			pdf.SetFont("Times", "BU", 10) // Bold and Underline
			pdf.Cell(columnWidth, 5, vlabel+":")
			pdf.Ln(5)

			// Driver if present
			if a.DriverID != nil && *a.DriverID != "" {
				if dp, ok := partByID[*a.DriverID]; ok {
					pdf.SetX(currentColumnX)
					pdf.SetFont("Times", "", 10)
					pdf.Cell(columnWidth, 5, dp.Name)
					pdf.Ln(5)
				}
			}

			// Participants
			pdf.SetFont("Times", "", 10)
			for _, pid := range a.ParticipantIDs {
				if pp, ok := partByID[pid]; ok {
					pdf.SetX(currentColumnX)
					pdf.Cell(columnWidth, 5, pp.Name)
					pdf.Ln(5)
				}
			}

			pdf.Ln(2) // spacing between vehicles
			if pdf.GetY() > maxY {
				maxY = pdf.GetY()
			}
		}
	}

	// Set Y position after box
	pdf.SetY(startY + boxHeight)

	// Driving time below box - centered and uppercase (only for driving type)
	if m.ToTimeType == "driving" {
		pdf.Ln(5)
		hr := 0
		mn := 0
		if m.DrivingTimeHours != nil {
			hr = *m.DrivingTimeHours
		}
		if m.DrivingTimeMinutes != nil {
			mn = *m.DrivingTimeMinutes
		}

		// Format: "DRIVING TIME: 2 HOURS" or "DRIVING TIME: 2 HOURS 15 MINUTES"
		drivingText := "DRIVING TIME: "
		if hr > 0 {
			if hr == 1 {
				drivingText += fmt.Sprintf("%d HOUR", hr)
			} else {
				drivingText += fmt.Sprintf("%d HOURS", hr)
			}
		}
		if mn > 0 {
			if hr > 0 {
				drivingText += " "
			}
			if mn == 1 {
				drivingText += fmt.Sprintf("%d MINUTE", mn)
			} else {
				drivingText += fmt.Sprintf("%d MINUTES", mn)
			}
		}

		// Center the text (already uppercase)
		pdf.SetFont("Times", "B", 11)
		pdf.CellFormat(pageWidth, 6, drivingText, "", 0, "C", false, 0, "")
		pdf.Ln(6)
		pdf.SetFont("Times", "", 11)

	}
}

func joinStrings(arr []string, sep string) string {
	if len(arr) == 0 {
		return ""
	}
	out := arr[0]
	for i := 1; i < len(arr); i++ {
		out += sep + arr[i]
	}
	return out
}

package handlers

import (
	"bytes"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"planning-system/backend/internal/models"
	"planning-system/backend/internal/repos"

	"github.com/jung-kurt/gofpdf"
)

// ExportPDF generates a PDF export of the event with days, blocks, movements, participants, locations, and vehicles.
func (h *Handlers) ExportPDF(w http.ResponseWriter, r *http.Request) {
	// Fetch data
	days, err := h.sv.Days.List(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to load days"}`, http.StatusInternalServerError)
		return
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

	pdf := gofpdf.New("P", "mm", "A4", "")

	// Register Times New Roman fonts
	pdf.AddUTF8Font("Times", "", filepath.Join("assets", "fonts", "times.ttf"))
	pdf.AddUTF8Font("Times", "B", filepath.Join("assets", "fonts", "timesbd.ttf"))
	pdf.AddUTF8Font("Times", "I", filepath.Join("assets", "fonts", "timesi.ttf"))
	pdf.AddUTF8Font("Times", "BI", filepath.Join("assets", "fonts", "timesbi.ttf"))

	pdf.SetMargins(12, 12, 12)
	pdf.SetAutoPageBreak(true, 12)

	// First page with banner and title only
	pdf.AddPage()

	// Add banner image - make it tall with auto-scaling width, centered horizontally
	bannerPath := filepath.Join("assets", "banner.png")
	options := gofpdf.ImageOptions{ImageType: "PNG", ReadDpi: true}
	pdf.RegisterImageOptions(bannerPath, options)

	// Set a tall height (most of the page), width will auto-scale proportionally
	pageHeight := 297.0 - 24.0       // A4 height minus margins (12mm top and bottom)
	bannerHeight := pageHeight * 0.5 // Use 70% of page height for banner

	// Get image info to calculate aspect ratio and scaled width
	imgInfo := pdf.GetImageInfo(bannerPath)
	pageWidth := 210.0      // A4 width in mm
	var bannerX float64 = 0 // Default to left margin

	if imgInfo != nil {
		// Calculate scaled width based on height and aspect ratio
		imgWidth := imgInfo.Width()
		imgHeight := imgInfo.Height()
		aspectRatio := imgWidth / imgHeight
		bannerWidth := bannerHeight * aspectRatio

		// Center horizontally: (pageWidth - bannerWidth) / 2
		bannerX = (pageWidth - bannerWidth) / 2
	}

	pdf.ImageOptions(bannerPath, bannerX, 12, 0, bannerHeight, false, options, 0, "")

	// Position title below banner, centered
	pdf.SetY(12 + bannerHeight + 20)
	pdf.SetFont("Times", "B", 18)
	pdf.CellFormat(0, 10, "GLOBAL LINE BY LINE", "", 0, "C", false, 0, "")

	// Section: Days
	for _, d := range days {
		pdf.AddPage()

		// Format date header: "SUNDAY, SEPTEMBER 14, 2025"
		dateStr := formatDateHeader(d.Date)
		pdf.SetFont("Times", "B", 14)
		pdf.CellFormat(0, 10, dateStr, "", 0, "L", false, 0, "")
		pdf.Ln(12)

		// Draw underline
		currentY := pdf.GetY()
		pdf.Line(12, currentY-2, 198, currentY-2) // Underline from left margin to right margin
		pdf.Ln(8)

		// Blocks (Activities)
		if len(d.Blocks) > 0 {
			for _, b := range d.Blocks {
				drawBlockBox(pdf, b, locByID, partByID)
				pdf.Ln(5)
			}
		}

		// Movements
		if len(d.Movements) > 0 {
			for _, m := range d.Movements {
				drawMovementBox(pdf, m, locByID, vehByID, partByID)
				pdf.Ln(5)
			}
		}
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

func drawBlockBox(pdf *gofpdf.Fpdf, b models.Block, locByID map[string]models.Location, partByID map[string]models.Participant) {
	margin := 12.0
	pageWidth := 210.0 - (margin * 2)
	x := margin

	// Set X position to margin so all text starts at the same position
	pdf.SetX(x)
	pdf.SetFont("Times", "BU", 13)
	// Format: "Event: [spaces] [activity name]"
	eventLine := "Event:            " + b.Title
	pdf.MultiCell(pageWidth, 6, eventLine, "", "L", false)

	// Add extra space between title and first sub-event
	pdf.Ln(8)

	// Reset X position for each line to ensure alignment
	pdf.SetX(x)
	pdf.SetFont("Times", "", 11)

	// Schedule items (sub-events) - all starting at same X position
	for _, si := range b.ScheduleItems {
		pdf.SetX(x) // Reset X position for each line
		// Use same spacing as "Event:            " (12 spaces) between time and description
		line := fmt.Sprintf("  %s            %s", si.Time, si.Description)
		pdf.MultiCell(pageWidth, 5, line, "", "L", false)

		// Staff/Guest Instructions - boxed
		hasStaff := si.StaffInstructions != ""
		hasGuest := si.GuestInstructions != ""

		if hasStaff || hasGuest {
			pdf.Ln(3) // More spacing at the top
			instStartY := pdf.GetY()
			instPadding := 2.0
			instContentWidth := pageWidth - (instPadding * 2)

			// Calculate content height without rendering
			pdf.SetFont("Times", "B", 11)
			titleHeight := 4.0
			contentHeight := titleHeight

			pdf.SetFont("Times", "", 10)
			if hasStaff && hasGuest && si.StaffInstructions == si.GuestInstructions {
				// Calculate height for combined instructions
				lines := pdf.SplitText(si.StaffInstructions, instContentWidth)
				contentHeight += float64(len(lines)) * 4.0
			} else {
				if hasStaff {
					lines := pdf.SplitText(si.StaffInstructions, instContentWidth)
					contentHeight += titleHeight + float64(len(lines))*4.0
				}
				if hasGuest {
					lines := pdf.SplitText(si.GuestInstructions, instContentWidth)
					contentHeight += titleHeight + float64(len(lines))*4.0
				}
			}

			instBoxHeight := contentHeight + (instPadding * 2) // Padding top and bottom

			// Draw box border first
			pdf.Rect(x, instStartY, pageWidth, instBoxHeight, "D")

			// Draw content on top of box (only once)
			pdf.SetXY(x+instPadding, instStartY+instPadding)
			if hasStaff && hasGuest && si.StaffInstructions == si.GuestInstructions {
				pdf.SetFont("Times", "B", 11)
				pdf.Cell(instContentWidth, 4, "STAFF / GUEST INSTRUCTIONS:")
				pdf.Ln(4)
				pdf.SetX(x + instPadding)
				pdf.SetFont("Times", "", 10)
				pdf.MultiCell(instContentWidth, 4, si.StaffInstructions, "", "L", false)
			} else {
				if hasStaff {
					pdf.SetFont("Times", "B", 11)
					pdf.Cell(instContentWidth, 4, "STAFF INSTRUCTIONS:")
					pdf.Ln(4)
					pdf.SetX(x + instPadding)
					pdf.SetFont("Times", "", 10)
					pdf.MultiCell(instContentWidth, 4, si.StaffInstructions, "", "L", false)
				}
				if hasGuest {
					pdf.SetFont("Times", "B", 11)
					pdf.Cell(instContentWidth, 4, "GUEST INSTRUCTIONS:")
					pdf.Ln(4)
					pdf.SetX(x + instPadding)
					pdf.SetFont("Times", "", 10)
					pdf.MultiCell(instContentWidth, 4, si.GuestInstructions, "", "L", false)
				}
			}

			// Set Y position after box
			pdf.SetY(instStartY + instBoxHeight)
		}

		// Notes in italics if present
		if si.Notes != nil && *si.Notes != "" {
			pdf.Ln(3) // Add margin top
			pdf.SetX(x)
			pdf.SetFont("Times", "BI", 11) // Italics
			noteLine := "NOTE: " + *si.Notes
			pdf.MultiCell(pageWidth, 6, noteLine, "", "L", false)
			pdf.SetFont("Times", "", 11) // Reset font
		}

		pdf.Ln(5) // Add extra line spacing between sub-events
	}

	// Calculate consistent spacing width for both Advance and Met By
	// Use the maximum label width to ensure consistent spacing
	advanceLabel := "Advance:"
	metByLabel := "Met By:"
	pdf.SetFont("Times", "", 11)
	advanceLabelWidth := pdf.GetStringWidth(advanceLabel)
	metByLabelWidth := pdf.GetStringWidth(metByLabel)
	maxLabelWidth := advanceLabelWidth
	if metByLabelWidth > maxLabelWidth {
		maxLabelWidth = metByLabelWidth
	}
	// Fixed spacing after label (same for both)
	fixedSpacingWidth := maxLabelWidth + pdf.GetStringWidth(" ")

	// Advance participants
	if len(b.AdvanceParticipantIDs) > 0 {
		pdf.Ln(3)
		pdf.SetX(x)
		pdf.SetFont("Times", "", 11)

		// Get first participant name
		var firstParticipantName string
		if len(b.AdvanceParticipantIDs) > 0 {
			if pp, ok := partByID[b.AdvanceParticipantIDs[0]]; ok {
				firstParticipantName = pp.Name
			}
		}

		// Calculate total width and center it
		totalWidth := fixedSpacingWidth + pdf.GetStringWidth(firstParticipantName)
		startX := x + (pageWidth-totalWidth)/2

		// Draw "Advance:" + space + first participant on same line
		pdf.SetX(startX)
		pdf.Cell(advanceLabelWidth, 5, advanceLabel)
		pdf.SetX(startX + fixedSpacingWidth)
		if firstParticipantName != "" {
			pdf.Cell(pageWidth, 5, firstParticipantName)
		}
		pdf.Ln(5)

		// Subsequent participants align with first participant name
		participantStartX := startX + fixedSpacingWidth
		for i := 1; i < len(b.AdvanceParticipantIDs); i++ {
			if pp, ok := partByID[b.AdvanceParticipantIDs[i]]; ok {
				pdf.SetX(participantStartX)
				pdf.Cell(pageWidth, 5, pp.Name)
				pdf.Ln(5)
			}
		}
	}

	// Met By participants
	if len(b.MetByParticipantIDs) > 0 {
		pdf.Ln(3)
		pdf.SetX(x)
		pdf.SetFont("Times", "", 11)

		// Get first participant name
		var firstParticipantName string
		if len(b.MetByParticipantIDs) > 0 {
			if pp, ok := partByID[b.MetByParticipantIDs[0]]; ok {
				firstParticipantName = pp.Name
			}
		}

		// Calculate total width and center it
		totalWidth := fixedSpacingWidth + pdf.GetStringWidth(firstParticipantName)
		startX := x + (pageWidth-totalWidth)/2

		// Draw "Met By:" + space + first participant on same line
		pdf.SetX(startX)
		pdf.Cell(metByLabelWidth, 5, metByLabel)
		pdf.SetX(startX + fixedSpacingWidth)
		if firstParticipantName != "" {
			pdf.Cell(pageWidth, 5, firstParticipantName)
		}
		pdf.Ln(5)

		// Subsequent participants align with first participant name
		participantStartX := startX + fixedSpacingWidth
		for i := 1; i < len(b.MetByParticipantIDs); i++ {
			if pp, ok := partByID[b.MetByParticipantIDs[i]]; ok {
				pdf.SetX(participantStartX)
				pdf.Cell(pageWidth, 5, pp.Name)
				pdf.Ln(5)
			}
		}
	}

	// Notes in italics if present (block-level notes)
	if b.Notes != "" {
		pdf.SetX(x)                   // Reset X position
		pdf.SetFont("Times", "I", 11) // Italics
		noteLine := "NOTE: " + b.Notes
		pdf.MultiCell(pageWidth, 6, noteLine, "", "L", false)
	}
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

document.addEventListener("DOMContentLoaded", function () {
    setAwardReportData("month");
    setConversionReportData("month");

    document.querySelectorAll(".revenue-card .filter ul li a.dropdown-item").forEach((item) => {
        item.addEventListener("click", function () {
            var filter = item.getAttribute("data-filter");
            setAwardReportData(filter);
            changeAwardTitle(this);
        });
    });

    document.querySelectorAll(".conversion-card .filter ul li a.dropdown-item").forEach((item) => {
        item.addEventListener("click", function () {
            var filter = item.getAttribute("data-filter");
            setConversionReportData(filter);
            changeConversionTitle(this);
        });
    });
});

function setAwardReportData( filter ) {
    const card = document.querySelector(".revenue-card");
    const report = JSON.parse(card.getAttribute("data-report"));

    card.querySelector(".ps-3 h6").innerText = report[`${filter}_count`];
    var percentage = report[`${filter}_difference_percentage`];
    var percentageElement = card.querySelector(".ps-3 span.percentage");
    var explanationElement = card.querySelector(".ps-3 span.explanation");

    if ( percentage>0 ) {
        percentageElement.innerText = percentage + "%";

        if (percentageElement.classList.contains("text-danger")) {
            percentageElement.classList.remove("text-danger");
        }

        percentageElement.classList.add("text-success");
        explanationElement.innerText = "increase";
    }
    else if ( percentage<0 ) {
        percentageElement.innerText = Math.abs(percentage) + "%";

        if (percentageElement.classList.contains("text-success")) {
            percentageElement.classList.remove("text-success");
        }

        if (percentageElement.classList.contains("text-muted")) {
            percentageElement.classList.remove("text-muted");
        }

        percentageElement.classList.add("text-danger");
        explanationElement.innerText = "decrease";
    }
    else {
        percentageElement.innerText = percentage + "%";

        if (percentageElement.classList.contains("text-success")) {
            percentageElement.classList.remove("text-success");
        }

        if (percentageElement.classList.contains("text-danger")) {
            percentageElement.classList.remove("text-danger");
        }

        percentageElement.classList.add("text-muted");
        explanationElement.innerText = "stable";
    }
}

function changeAwardTitle( item ) {
    const titleElement = document.querySelector(".revenue-card .card-body h5.card-title span");
    titleElement.innerText = "| " + item.innerText;
}

function setConversionReportData( filter ) {
    const card = document.querySelector(".conversion-card");
    const report = JSON.parse(card.getAttribute("data-report"));

    card.querySelector(".ps-3 h6").innerText = report[`${filter}_rate`] + " %";
    var rate = report[`${filter}_difference_rate`];
    var rateElement = card.querySelector(".ps-3 span.rate");
    var explanationElement = card.querySelector(".ps-3 span.explanation");

    if ( rate>0 ) {
        rateElement.innerText = rate + "%";

        if (rateElement.classList.contains("text-danger")) {
            rateElement.classList.remove("text-danger");
        }

        rateElement.classList.add("text-success");
        explanationElement.innerText = "increase";
    }
    else if ( rate<0 ) {
        rateElement.innerText = Math.abs(rate) + "%";

        if (rateElement.classList.contains("text-success")) {
            rateElement.classList.remove("text-success");
        }

        if (rateElement.classList.contains("text-muted")) {
            rateElement.classList.remove("text-muted");
        }

        rateElement.classList.add("text-danger");
        explanationElement.innerText = "decrease";
    }
    else {
        rateElement.innerText = rate + "%";

        if (rateElement.classList.contains("text-success")) {
            rateElement.classList.remove("text-success");
        }

        if (rateElement.classList.contains("text-danger")) {
            rateElement.classList.remove("text-danger");
        }

        rateElement.classList.add("text-muted");
        explanationElement.innerText = "stable";
    }
}

function changeConversionTitle( item ) {
    const titleElement = document.querySelector(".conversion-card .card-body h5.card-title span");
    titleElement.innerText = "| " + item.innerText;
}

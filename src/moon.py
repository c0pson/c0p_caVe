from src.constants import MOON, LAST_KNOWN_NEW_MOON

from datetime import date, datetime

class MoonPhaseCalculator:
    def __init__(self) -> None:
        self.last_known_new_moon = date(*LAST_KNOWN_NEW_MOON)
        self.todays = datetime.today().date()
        self.update()
        self.moon_phase()

    def time_diff_from_last_new_moon(self) -> int:
        return (self.todays - self.last_known_new_moon).days

    def update(self) -> None:
        self.todays = datetime.today().date()

    def moon_phase(self) -> MOON:
        self.update()
        d: int = self.time_diff_from_last_new_moon()
        n: float = 29.53058770576
        lunar_day: float = d % n
        phase: MOON
        if           0 < lunar_day <= 1         : phase = MOON.NEW_MOON
        elif         1 < lunar_day <= 6.382647  : phase = MOON.WAXING_CRESCENT
        elif  6.382647 < lunar_day <= 8.382647  : phase = MOON.FIRST_QUARTER
        elif  8.382647 < lunar_day <= 13.765294 : phase = MOON.WAXING_GIBBOUS
        elif 13.765294 < lunar_day <= 15.765294 : phase = MOON.FULL_MOON
        elif 15.765294 < lunar_day <= 21.147941 : phase = MOON.WANING_GIBBOUS
        elif 21.147941 < lunar_day <= 23.147941 : phase = MOON.LAST_QUARTER
        elif 23.147941 < lunar_day <= 28.530588 : phase = MOON.WANING_CRESCENT
        elif 28.530588 < lunar_day <= 29.530588 : phase = MOON.NEW_MOON
        return phase

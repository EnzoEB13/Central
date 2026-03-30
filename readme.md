CREATE TABLE IF NOT EXISTS vacations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_code VARCHAR(50) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  INDEX idx_vacations_user_code (user_code),
  INDEX idx_vacations_range (start_date, end_date)
);

CREATE TABLE IF NOT EXISTS holidays (
  id INT AUTO_INCREMENT PRIMARY KEY,
  holiday_date DATE NOT NULL,
  description VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  UNIQUE KEY uq_holiday_date (holiday_date)
);

CREATE TABLE IF NOT EXISTS leaves_absences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_code VARCHAR(50) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  INDEX idx_leaves_user_code (user_code),
  INDEX idx_leaves_range (start_date, end_date)
);
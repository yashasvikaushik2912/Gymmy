import pygame
import sys
import math

# Initialize
pygame.init()
screen = pygame.display.set_mode((800, 480))  # Match 5" HDMI resolution
pygame.display.set_caption("Robot Face")

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
BLUE  = (30, 144, 255)

# Eye positions
eye_radius = 60
pupil_radius = 20
eye1_center = (250, 240)
eye2_center = (550, 240)

def draw_face(mx, my):
    screen.fill(WHITE)

    for eye_center in [eye1_center, eye2_center]:
        pygame.draw.circle(screen, BLACK, eye_center, eye_radius)  # Eye
        dx, dy = mx - eye_center[0], my - eye_center[1]
        dist = math.hypot(dx, dy)
        if dist > (eye_radius - pupil_radius):
            dx *= (eye_radius - pupil_radius) / dist
            dy *= (eye_radius - pupil_radius) / dist
        pupil_pos = (eye_center[0] + dx, eye_center[1] + dy)
        pygame.draw.circle(screen, BLUE, pupil_pos, pupil_radius)  # Pupil

    pygame.draw.arc(screen, BLACK, (300, 300, 200, 100), math.pi, 2*math.pi, 5)  # Smile

    pygame.display.flip()

# Main loop
while True:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            pygame.quit()
            sys.exit()

    mx, my = pygame.mouse.get_pos()
    draw_face(mx, my)
